import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/modals.dart';
import 'productos_models.dart';

/// Lo que devuelve [pickCategory]: la categoría elegida o `null` si se eligió
/// la opción "ninguna / todas". (Cerrar la hoja sin elegir devuelve `null` del
/// Future, que es distinto.)
class CategoryPick {
  const CategoryPick(this.id);
  final String? id;
}

/// Hoja inferior para elegir una categoría del árbol (con búsqueda). Las
/// subcategorías van indentadas. `noneLabel` agrega una primera opción que
/// devuelve `CategoryPick(null)` ("Todas las categorías", "Ninguna…").
Future<CategoryPick?> pickCategory(
  BuildContext context, {
  required List<CategoryOption> options,
  String? selectedId,
  String? noneLabel,
  String title = 'Elegí una categoría',
  Set<String> excludeIds = const {},
}) {
  // Hoja estándar de la app (2026-11-14, pedido de Ale: "que se vean bien los
  // modales"): nunca debajo de la barra de estado y con su manija para cerrar.
  return showAppSheet<CategoryPick>(
    context,
    builder: (ctx) => _CategorySheet(
      options: options.where((o) => !excludeIds.contains(o.id)).toList(),
      selectedId: selectedId,
      noneLabel: noneLabel,
      title: title,
    ),
  );
}

class _CategorySheet extends StatefulWidget {
  const _CategorySheet({
    required this.options,
    required this.selectedId,
    required this.noneLabel,
    required this.title,
  });
  final List<CategoryOption> options;
  final String? selectedId;
  final String? noneLabel;
  final String title;

  @override
  State<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<_CategorySheet> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = _search.text.trim().toLowerCase();
    final searching = q.isNotEmpty;
    final shown = searching
        ? widget.options.where((o) => o.path.toLowerCase().contains(q)).toList()
        : widget.options;
    // Alto fijo (la hoja no salta mientras se filtra). Si no entra —teléfono
    // chico con el teclado abierto— la hoja lo recorta sola y la lista se
    // queda con el lugar que sobra.
    final height = MediaQuery.sizeOf(context).height * 0.78;

    return Padding(
      // Con el teclado abierto la hoja sube entera; cerrado, deja libre la
      // barra de gestos (antes la última categoría quedaba debajo).
      padding: EdgeInsets.only(bottom: sheetBottomInset(context)),
      child: SizedBox(
        height: height,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Buscar categoría…',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Borrar la búsqueda',
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => setState(_search.clear),
                        ),
                ),
              ),
            ),
            Expanded(
              // Material propio: el fondo de la fila elegida y la onda al tocar
              // se recortan a la lista (si no, se pintaban sobre el buscador).
              child: Material(
                type: MaterialType.transparency,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                  children: [
                    if (widget.noneLabel != null && !searching)
                      _row(
                        icon: Icons.apps_rounded,
                        iconColor: c.textDim,
                        label: widget.noneLabel!,
                        selected: widget.selectedId == null,
                        onTap: () => Navigator.pop(context, const CategoryPick(null)),
                      ),
                    if (shown.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(32),
                        child: Center(
                          child: Text(
                            'No hay categorías con ese nombre.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: c.textDim),
                          ),
                        ),
                      ),
                    for (final o in shown)
                      _row(
                        icon: o.depth == 0 || searching
                            ? Icons.folder_rounded
                            : Icons.subdirectory_arrow_right_rounded,
                        iconColor: o.depth == 0 ? Brand.gold : c.textDim,
                        label: searching ? o.path : o.name,
                        selected: o.id == widget.selectedId,
                        indent: searching ? 0 : o.depth.clamp(0, 5),
                        onTap: () => Navigator.pop(context, CategoryPick(o.id)),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Una fila de la lista. La elegida se marca con fondo suave, letra más
  /// gruesa y tilde: el texto sigue con el color normal (dorado sobre blanco
  /// no se leía en el tema claro).
  Widget _row({
    required IconData icon,
    required Color iconColor,
    required String label,
    required bool selected,
    required VoidCallback onTap,
    int indent = 0,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.only(left: 16 + indent * 16.0, right: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      tileColor: selected ? Brand.gold.withValues(alpha: 0.14) : null,
      leading: Icon(icon, size: 20, color: iconColor),
      title: Text(
        label,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: selected ? const TextStyle(fontWeight: FontWeight.w700) : null,
      ),
      trailing: selected ? const Icon(Icons.check_rounded, color: Brand.gold) : null,
      onTap: onTap,
    );
  }
}
