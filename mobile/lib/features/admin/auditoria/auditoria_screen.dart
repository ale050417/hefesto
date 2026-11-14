import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import 'audit_detail_screen.dart';
import 'audit_labels.dart';
import 'audit_models.dart';
import 'audit_providers.dart';

/// Auditoría: quién hizo qué y cuándo. Lista cronológica (lo más nuevo
/// arriba) con búsqueda, filtros por tipo / persona / acción / período y
/// detalle de cada evento. Solo lectura. (Se abre desde "Más".)
class AdminAuditoriaScreen extends StatelessWidget {
  const AdminAuditoriaScreen({super.key});

  @override
  Widget build(BuildContext context) => const AdminModuleScaffold(
        title: 'Auditoría',
        permission: 'auditoria',
        what: 'el registro de auditoría',
        body: AuditBody(),
      );
}

/// Cuerpo de la pantalla (separado para poder probarlo y para que el permiso
/// lo resuelva el scaffold).
class AuditBody extends ConsumerStatefulWidget {
  const AuditBody({super.key});

  @override
  ConsumerState<AuditBody> createState() => _AuditBodyState();
}

class _AuditBodyState extends ConsumerState<AuditBody> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    if (_scroll.position.extentAfter < 500) {
      ref.read(auditListProvider.notifier).loadMore();
    }
  }

  void _onSearchChanged(String text) {
    setState(() {}); // para el botón de borrar
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      final ctl = ref.read(auditListProvider.notifier);
      final cur = ref.read(auditListProvider).filters;
      if (cur.q != text.trim()) ctl.setFilters(cur.copyWith(q: text.trim()));
    });
  }

  void _setFilters(AuditFilters f) => ref.read(auditListProvider.notifier).setFilters(f);

  Future<void> _openFilters(AuditListState st) async {
    // Hoja estándar de la app (2026-11-14, pedido de Ale): no se mete debajo
    // del notch, se desplaza si no entra y deja "Aplicar" fijo y a la vista.
    final result = await showAppSheet<AuditFilters>(
      context,
      builder: (_) => AuditFilterSheet(initial: st.filters, facets: st.facets),
    );
    if (result != null && mounted) _setFilters(result);
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(auditListProvider);
    final c = context.hc;
    final f = st.filters;
    final facets = st.facets;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  onChanged: _onSearchChanged,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (t) {
                    _debounce?.cancel();
                    _setFilters(f.copyWith(q: t.trim()));
                  },
                  decoration: InputDecoration(
                    hintText: 'Buscar: pedido, producto, persona…',
                    prefixIcon: Icon(Icons.search_rounded, color: c.textFaint),
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Borrar búsqueda',
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () {
                              _search.clear();
                              _debounce?.cancel();
                              setState(() {});
                              _setFilters(f.copyWith(q: ''));
                            },
                          ),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _FilterButton(
                active: f.hasChips,
                onTap: () => _openFilters(st),
              ),
            ],
          ),
        ),
        _EntityChips(
          selected: f.entity,
          entities: facets?.entityTypes ?? const [],
          onSelected: (e) => _setFilters(f.copyWith(entity: e)),
        ),
        if (f.action != null || f.actor != null || f.period != AuditPeriod.all)
          _ActiveFilters(filters: f, facets: facets, onChanged: _setFilters),
        Expanded(child: _content(st)),
      ],
    );
  }

  Widget _content(AuditListState st) {
    if (st.loading && st.items.isEmpty) return const ListSkeleton(rows: 6, height: 84);
    if (st.error != null && st.items.isEmpty) {
      return ErrorView(
        message: st.error!,
        onRetry: () => ref.read(auditListProvider.notifier).refresh(),
      );
    }
    if (st.items.isEmpty) {
      final filtered = !st.filters.isEmpty;
      return RefreshIndicator(
        color: Brand.gold,
        onRefresh: () => ref.read(auditListProvider.notifier).refresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: 380,
              child: EmptyView(
                icon: filtered ? Icons.search_off_rounded : Icons.fact_check_rounded,
                title: filtered ? 'No hay registros con esos filtros' : 'Todavía no hay registros',
                subtitle: filtered
                    ? 'Probá con otra búsqueda o sacá algún filtro.'
                    : 'Acá van a aparecer las acciones sensibles del equipo.',
                action: filtered
                    ? GoldButton(
                        label: 'Limpiar filtros',
                        expand: false,
                        onPressed: () {
                          _search.clear();
                          _setFilters(const AuditFilters());
                        },
                      )
                    : null,
              ),
            ),
          ],
        ),
      );
    }

    final rows = groupAuditByDay(st.items, DateTime.now());
    final footer = st.hasMore || st.loadingMore || st.moreError != null ? 1 : 0;
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: () => ref.read(auditListProvider.notifier).refresh(),
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        itemCount: rows.length + footer,
        itemBuilder: (context, i) {
          if (i >= rows.length) return _Footer(state: st);
          final row = rows[i];
          if (row is _DayHeader) return _DayTitle(row.label);
          final e = (row as _EntryRow).entry;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AuditTile(
              entry: e,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => AuditDetailScreen(entry: e)),
              ),
            ),
          );
        },
      ),
    );
  }
}

// --- Agrupado por día ---

sealed class _Row {
  const _Row();
}

class _DayHeader extends _Row {
  const _DayHeader(this.label);
  final String label;
}

class _EntryRow extends _Row {
  const _EntryRow(this.entry);
  final AuditEntry entry;
}

String _capitalize(String s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

/// "Hoy" / "Ayer" / "Lunes 27 de octubre".
String auditDayLabel(DateTime day, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  final d = DateTime(day.year, day.month, day.day);
  final diff = today.difference(d).inDays;
  if (diff == 0) return 'Hoy';
  if (diff == 1) return 'Ayer';
  return _capitalize(formatLongDay(d));
}

/// Intercala un título de día antes del primer evento de cada día.
List<Object> groupAuditByDay(List<AuditEntry> items, DateTime now) {
  final out = <Object>[];
  DateTime? current;
  for (final e in items) {
    final d = DateTime(e.createdAt.year, e.createdAt.month, e.createdAt.day);
    if (current != d) {
      current = d;
      out.add(_DayHeader(auditDayLabel(d, now)));
    }
    out.add(_EntryRow(e));
  }
  return out;
}

class _DayTitle extends StatelessWidget {
  const _DayTitle(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 14, 0, 8),
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
            fontFamily: 'Orbitron',
            fontSize: 10.5,
            letterSpacing: 1.6,
            fontWeight: FontWeight.w700,
            color: context.hc.textFaint,
          ),
        ),
      );
}

// --- Fila ---

/// Una fila del registro: ícono por tipo de acción, qué pasó, quién y cuándo.
class AuditTile extends StatelessWidget {
  const AuditTile({super.key, required this.entry, required this.onTap});
  final AuditEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final kind = auditKindOf(entry.action);
    final summary = auditSummary(entry);
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: kind.color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(kind.icon, size: 20, color: kind.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  auditActionLabel(entry.action, serverLabel: entry.actionLabel),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                if (summary != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    summary,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.3),
                  ),
                ],
                const SizedBox(height: 7),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          entry.actor == null ? auditNoActorIcon(entry.action) : Icons.person_outline_rounded,
                          size: 13,
                          color: c.textFaint,
                        ),
                        const SizedBox(width: 3),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 150),
                          child: Text(
                            entry.actor == null ? auditNoActorName(entry.action) : entry.actor!.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      DateFormat('HH:mm', 'es_AR').format(entry.createdAt),
                      style: TextStyle(fontSize: 12, color: c.textFaint),
                    ),
                    if (entry.entityType != null) MiniTag(auditEntityLabel(entry.entityType)),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 10, left: 4),
            child: Icon(Icons.chevron_right_rounded, size: 20, color: c.textFaint),
          ),
        ],
      ),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({required this.state});
  final AuditListState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.moreError != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Text(state.moreError!,
                textAlign: TextAlign.center, style: TextStyle(color: context.hc.textDim, fontSize: 12.5)),
            TextButton(
              onPressed: () => ref.read(auditListProvider.notifier).loadMore(),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      );
    }
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 18),
      child: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2.4, color: Brand.gold),
        ),
      ),
    );
  }
}

// --- Filtros ---

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.active, required this.onTap});
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Tooltip(
      message: 'Filtros',
      child: Material(
        color: active ? Brand.gold.withValues(alpha: 0.16) : c.surface2,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: active ? Brand.gold : c.border),
            ),
            child: Icon(Icons.tune_rounded, color: active ? Brand.gold : c.textDim),
          ),
        ),
      ),
    );
  }
}

/// Fila de chips por tipo de entidad (Todo · Pedidos · Productos…).
class _EntityChips extends StatelessWidget {
  const _EntityChips({required this.selected, required this.entities, required this.onSelected});
  final String? selected;
  final List<AuditFacetEntity> entities;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    // Si el filtro activo no está entre las opciones (ej. vino de otro lado), se muestra igual.
    final values = [
      for (final e in entities) e.value,
      if (selected != null && !entities.any((e) => e.value == selected)) selected!,
    ];
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: const Text('Todo'),
              selected: selected == null,
              onSelected: (_) => onSelected(null),
            ),
          ),
          for (final v in values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(auditEntityLabel(v)),
                selected: selected == v,
                onSelected: (_) => onSelected(selected == v ? null : v),
              ),
            ),
        ],
      ),
    );
  }
}

/// Chips de los filtros activos (persona, acción, período) con su "x".
class _ActiveFilters extends StatelessWidget {
  const _ActiveFilters({required this.filters, required this.facets, required this.onChanged});
  final AuditFilters filters;
  final AuditFacets? facets;
  final ValueChanged<AuditFilters> onChanged;

  @override
  Widget build(BuildContext context) {
    final actorName = _actorName(facets, filters.actor);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Wrap(
          spacing: 8,
          runSpacing: 0,
          children: [
            if (filters.period != AuditPeriod.all)
              InputChip(
                label: Text(filters.period.label),
                onDeleted: () => onChanged(filters.copyWith(period: AuditPeriod.all)),
              ),
            if (filters.actor != null)
              InputChip(
                label: Text(actorName, overflow: TextOverflow.ellipsis),
                onDeleted: () => onChanged(filters.copyWith(actor: null)),
              ),
            if (filters.action != null)
              InputChip(
                label: Text(
                  auditActionLabel(filters.action!, serverLabel: _actionServerLabel(facets, filters.action)),
                  overflow: TextOverflow.ellipsis,
                ),
                onDeleted: () => onChanged(filters.copyWith(action: null)),
              ),
          ],
        ),
      ),
    );
  }
}

String _actorName(AuditFacets? facets, String? id) {
  if (id == null) return '';
  if (id == 'sistema') return 'Sistema';
  for (final a in facets?.actors ?? const <AuditFacetActor>[]) {
    if (a.id == id) return a.name ?? 'Sin nombre';
  }
  return 'Una persona';
}

String? _actionServerLabel(AuditFacets? facets, String? code) {
  for (final a in facets?.actions ?? const <AuditFacetAction>[]) {
    if (a.value == code) return a.label;
  }
  return null;
}

/// Hoja con todos los filtros: período, tipo, persona y acción.
class AuditFilterSheet extends StatefulWidget {
  const AuditFilterSheet({super.key, required this.initial, required this.facets});
  final AuditFilters initial;
  final AuditFacets? facets;

  @override
  State<AuditFilterSheet> createState() => _AuditFilterSheetState();
}

class _AuditFilterSheetState extends State<AuditFilterSheet> {
  late AuditFilters _f = widget.initial;

  Widget _group(String title, List<Widget> chips, {bool first = false}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(2, first ? 0 : 14, 0, 8),
            child: Text(
              title.toUpperCase(),
              style: TextStyle(
                fontFamily: 'Orbitron',
                fontSize: 10.5,
                letterSpacing: 1.8,
                fontWeight: FontWeight.w700,
                color: context.hc.textFaint,
              ),
            ),
          ),
          Wrap(spacing: 8, runSpacing: 4, children: chips),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final facets = widget.facets;
    final actors = facets?.actors ?? const <AuditFacetActor>[];
    final actions = facets?.actions ?? const <AuditFacetAction>[];
    return SheetBody(
      title: 'Filtros',
      footer: Row(
        children: [
          TextButton(
            onPressed: () => setState(() => _f = AuditFilters(q: _f.q)),
            child: const Text('Limpiar'),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GoldButton(
              label: 'Aplicar',
              onPressed: () => Navigator.of(context).pop(_f),
            ),
          ),
        ],
      ),
      children: [
        _group('Período', [
          for (final p in AuditPeriod.values)
            ChoiceChip(
              label: Text(p.label),
              selected: _f.period == p,
              onSelected: (_) => setState(() => _f = _f.copyWith(period: p)),
            ),
        ], first: true),
        if (actors.isNotEmpty)
          _group('Persona', [
            ChoiceChip(
              label: const Text('Cualquiera'),
              selected: _f.actor == null,
              onSelected: (_) => setState(() => _f = _f.copyWith(actor: null)),
            ),
            for (final a in actors)
              ChoiceChip(
                label: Text(a.isSystem ? 'Sistema' : (a.name ?? 'Sin nombre'), overflow: TextOverflow.ellipsis),
                selected: _f.actor == a.id,
                onSelected: (_) => setState(() => _f = _f.copyWith(actor: _f.actor == a.id ? null : a.id)),
              ),
          ]),
        if (actions.isNotEmpty)
          _group('Acción', [
            ChoiceChip(
              label: const Text('Cualquiera'),
              selected: _f.action == null,
              onSelected: (_) => setState(() => _f = _f.copyWith(action: null)),
            ),
            for (final a in actions)
              ChoiceChip(
                label: Text(auditActionLabel(a.value, serverLabel: a.label), overflow: TextOverflow.ellipsis),
                selected: _f.action == a.value,
                onSelected: (_) =>
                    setState(() => _f = _f.copyWith(action: _f.action == a.value ? null : a.value)),
              ),
          ]),
        if (actors.isEmpty && actions.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(
              'Las opciones de persona y acción aparecen cuando carga el registro.',
              style: TextStyle(color: context.hc.textDim, fontSize: 13),
            ),
          ),
      ],
    );
  }
}
