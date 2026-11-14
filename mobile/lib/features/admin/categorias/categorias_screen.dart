import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../productos/catalogo_ui.dart';
import '../stock_screen.dart' show hexColor;
import 'categoria_form_screen.dart';
import 'categorias_models.dart';
import 'categorias_providers.dart';

/// Categorías del catálogo en árbol (con subcategorías de cualquier nivel):
/// ver, crear, editar y eliminar, con las mismas reglas que la web. Comparte el
/// permiso de módulo `productos`. Se abre desde "Más".
class AdminCategoriasScreen extends ConsumerStatefulWidget {
  const AdminCategoriasScreen({super.key});

  @override
  ConsumerState<AdminCategoriasScreen> createState() => _AdminCategoriasScreenState();
}

class _AdminCategoriasScreenState extends ConsumerState<AdminCategoriasScreen> {
  final _search = TextEditingController();
  final _expanded = <String>{};

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(adminCategoriesProvider);
    try {
      await ref.read(adminCategoriesProvider.future);
    } catch (_) {
      // El error ya lo muestra la lista.
    }
  }

  void _toggle(String id) => setState(() {
        if (!_expanded.remove(id)) _expanded.add(id);
      });

  Future<void> _openForm(
    AdminCategoriesData data, {
    AdminCategory? category,
    String? parentId,
  }) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AdminCategoryFormScreen(
          all: data.items,
          category: category,
          initialParentId: parentId,
        ),
      ),
    );
    // Si se creó una subcategoría, el padre se despliega para que se vea.
    if (saved == true && parentId != null && mounted) {
      setState(() => _expanded.add(parentId));
    }
  }

  Future<void> _delete(AdminCategory cat) async {
    // Mismas reglas que la web: sin productos y sin subcategorías.
    if (cat.productCount > 0 || cat.hasChildren) {
      final why = cat.productCount > 0
          ? 'Tiene ${cat.productCount} ${cat.productCount == 1 ? 'producto' : 'productos'}. '
              'Pasalos a otra categoría primero.'
          : 'Tiene ${cat.childCount} ${cat.childCount == 1 ? 'subcategoría' : 'subcategorías'}. '
              'Borralas o pasalas a otra categoría primero.';
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          // Desplazable: un nombre largo con letra grande no entra entero.
          scrollable: true,
          title: Text('No se puede borrar "${cat.name}"'),
          content: Text(why),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Entendido'))],
        ),
      );
      return;
    }
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar "${cat.name}"?',
      message: 'No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await ref.read(categoriasRepoProvider).delete(cat.id);
      invalidateCategories(ref);
      if (mounted) showSnack(context, 'Categoría eliminada');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } catch (_) {
      if (mounted) showSnack(context, 'Ocurrió un error inesperado. Probá de nuevo.', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('productos', 'crear') ?? false;
    final canEdit = me?.can('productos', 'editar') ?? false;
    final canDelete = me?.can('productos', 'eliminar') ?? false;
    final async = ref.watch(adminCategoriesProvider);
    final data = async.value;

    return AdminModuleScaffold(
      title: 'Categorías',
      permission: 'productos',
      what: 'las categorías',
      floatingActionButton: canCreate && data != null
          ? FloatingActionButton.extended(
              onPressed: () => _openForm(data),
              backgroundColor: Brand.gold,
              foregroundColor: Brand.goldFg,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nueva', style: TextStyle(fontWeight: FontWeight.w700)),
            )
          : null,
      body: async.when(
        loading: () => const ListSkeleton(rows: 6, height: 76),
        error: (e, _) =>
            ErrorView(message: errorText(e), onRetry: () => ref.invalidate(adminCategoriesProvider)),
        data: (data) {
          final visible = visibleCategories(data.items, _expanded, query: _search.text);
          final searching = _search.text.trim().isNotEmpty;
          return RefreshIndicator(
            color: Brand.gold,
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _Counter(label: 'Principales', value: '${data.summary.roots}', color: Brand.info),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Counter(
                        label: 'Subniveles',
                        value: '${data.summary.subcategories}',
                        color: Brand.warning,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Counter(
                        label: 'Productos',
                        value: '${data.summary.productsCategorized}',
                        color: Brand.success,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (data.items.isNotEmpty)
                  TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Buscar categoría…',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () => setState(_search.clear),
                            ),
                    ),
                  ),
                const SizedBox(height: 12),
                if (data.items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: EmptyView(
                      icon: Icons.folder_open_rounded,
                      title: 'Todavía no hay categorías',
                      subtitle: canCreate
                          ? 'Tocá "Nueva" para crear la primera.'
                          : 'Cuando se creen categorías, aparecen acá.',
                    ),
                  )
                else if (visible.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: EmptyView(
                      icon: Icons.search_off_rounded,
                      title: 'Sin resultados',
                      subtitle: 'Probá con otro nombre.',
                    ),
                  )
                else
                  for (final cat in visible) ...[
                    _CategoryTile(
                      cat: cat,
                      // En la búsqueda la lista es plana: sin sangría ni flecha.
                      indent: searching ? 0 : cat.depth.clamp(0, 4),
                      showPath: searching && cat.depth > 0,
                      expanded: _expanded.contains(cat.id),
                      flat: searching,
                      canEdit: canEdit,
                      canCreate: canCreate,
                      canDelete: canDelete,
                      onToggle: () => _toggle(cat.id),
                      onEdit: () => _openForm(data, category: cat),
                      onAddChild: () => _openForm(data, parentId: cat.id),
                      onDelete: () => _delete(cat),
                    ),
                    const SizedBox(height: 8),
                  ],
                if (data.items.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Center(
                      child: Text(
                        'Las imágenes de cada categoría se cambian desde el panel web.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11.5, color: c.textFaint),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.cat,
    required this.indent,
    required this.showPath,
    required this.expanded,
    required this.flat,
    required this.canEdit,
    required this.canCreate,
    required this.canDelete,
    required this.onToggle,
    required this.onEdit,
    required this.onAddChild,
    required this.onDelete,
  });

  final AdminCategory cat;
  final int indent;
  final bool showPath;
  final bool expanded;
  final bool flat;
  final bool canEdit;
  final bool canCreate;
  final bool canDelete;
  final VoidCallback onToggle;
  final VoidCallback onEdit;
  final VoidCallback onAddChild;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final tint = hexColor(cat.color, fallback: Brand.gold);
    final hasChildren = cat.hasChildren && !flat;
    final count = cat.totalProductCount;
    final subtitle = [
      '$count ${count == 1 ? 'producto' : 'productos'}',
      if (cat.childCount > 0) '${cat.childCount} sub',
    ].join(' · ');

    final items = <PopupMenuEntry<String>>[
      if (canEdit) const PopupMenuItem(value: 'edit', child: _MenuRow(Icons.edit_rounded, 'Editar')),
      if (canCreate)
        const PopupMenuItem(
          value: 'child',
          child: _MenuRow(Icons.subdirectory_arrow_right_rounded, 'Nueva subcategoría'),
        ),
      if (canDelete)
        const PopupMenuItem(
          value: 'delete',
          child: _MenuRow(Icons.delete_outline_rounded, 'Eliminar', danger: true),
        ),
    ];

    return Padding(
      padding: EdgeInsets.only(left: indent * 14.0),
      child: AdminCard(
        padding: const EdgeInsets.fromLTRB(6, 8, 2, 8),
        // Una categoría con subcategorías se despliega al tocarla; una sin
        // hijas abre su edición.
        onTap: hasChildren ? onToggle : (canEdit ? onEdit : null),
        child: Row(
          children: [
            SizedBox(
              width: 30,
              child: hasChildren
                  ? AnimatedRotation(
                      turns: expanded ? 0.25 : 0,
                      duration: const Duration(milliseconds: 150),
                      child: Icon(Icons.chevron_right_rounded, size: 22, color: c.textDim),
                    )
                  : null,
            ),
            Container(
              width: 40,
              height: 40,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(13),
              ),
              child: cat.imageUrl != null
                  ? NetImage(cat.imageUrl)
                  : Icon(categoryIconData(cat.icon), size: 21, color: tint),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    cat.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, height: 1.25),
                  ),
                  if (showPath)
                    Text(
                      cat.path,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11, color: c.textFaint),
                    ),
                  Text(subtitle, style: TextStyle(fontSize: 12, color: c.textDim)),
                ],
              ),
            ),
            if (items.isNotEmpty)
              PopupMenuButton<String>(
                tooltip: 'Acciones',
                padding: EdgeInsets.zero,
                icon: Icon(Icons.more_vert_rounded, color: c.textDim),
                itemBuilder: (_) => items,
                onSelected: (v) {
                  switch (v) {
                    case 'edit':
                      onEdit();
                    case 'child':
                      onAddChild();
                    case 'delete':
                      onDelete();
                  }
                },
              )
            else
              const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.danger = false});
  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? Brand.danger : null;
    return Row(
      children: [
        Icon(icon, size: 20, color: color ?? context.hc.textDim),
        const SizedBox(width: 12),
        Flexible(child: Text(label, style: TextStyle(color: color))),
      ],
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      accent: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontFamily: 'Orbitron',
                fontWeight: FontWeight.w800,
                fontSize: 22,
                color: color,
              ),
            ),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
