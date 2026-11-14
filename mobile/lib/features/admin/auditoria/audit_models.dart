import 'dart:convert';

/// Modelos de Auditoría (`/api/v1/admin/auditoria`). Parseo defensivo: el
/// servidor puede mandar nulls, el detalle (`metadata`) es JSON libre y las
/// fechas vienen en ISO.

String? _str(Object? v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

DateTime _date(Object? v) =>
    DateTime.tryParse('${v ?? ''}')?.toLocal() ?? DateTime.fromMillisecondsSinceEpoch(0);

List<Map<String, dynamic>> _maps(Object? v) => [
      if (v is List)
        for (final e in v)
          if (e is Map) Map<String, dynamic>.from(e),
    ];

/// Quién hizo la acción (null en el evento = lo hizo el sistema).
class AuditActor {
  const AuditActor({required this.id, this.name, this.role});

  final String id;
  final String? name;
  final String? role;

  factory AuditActor.fromJson(Map<String, dynamic> j) =>
      AuditActor(id: '${j['id'] ?? ''}', name: _str(j['name']), role: _str(j['role']));

  String get displayName => name ?? 'Sin nombre';

  /// "Administrador" / "Operador" para el rol de acceso.
  String? get roleLabel => switch (role) {
        'admin' => 'Administrador',
        'operator' => 'Operador',
        'customer' => 'Cliente',
        _ => null,
      };
}

/// Un evento del registro.
class AuditEntry {
  const AuditEntry({
    required this.id,
    required this.action,
    this.actionLabel,
    this.entityType,
    this.entityId,
    this.metadata,
    required this.createdAt,
    this.actor,
  });

  final String id;

  /// Código (`order.status_changed`).
  final String action;

  /// Texto en castellano que arma el servidor (por si la app no conoce el código).
  final String? actionLabel;
  final String? entityType;
  final String? entityId;

  /// Detalle libre (casi siempre un objeto; puede ser null).
  final Object? metadata;
  final DateTime createdAt;
  final AuditActor? actor;

  Map<String, dynamic> get metaMap =>
      metadata is Map ? Map<String, dynamic>.from(metadata as Map) : const {};

  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(
        id: '${j['id'] ?? ''}',
        action: '${j['action'] ?? ''}',
        actionLabel: _str(j['actionLabel']),
        entityType: _str(j['entityType']),
        entityId: _str(j['entityId']),
        metadata: j['metadata'],
        createdAt: _date(j['createdAt']),
        actor: j['actor'] is Map ? AuditActor.fromJson(Map<String, dynamic>.from(j['actor'] as Map)) : null,
      );

  /// El detalle como JSON legible (para "Datos técnicos").
  String get prettyMetadata =>
      metadata == null ? '' : const JsonEncoder.withIndent('  ').convert(metadata);
}

class AuditFacetAction {
  const AuditFacetAction({required this.value, this.label, required this.count});
  final String value;
  final String? label;
  final int count;
}

class AuditFacetEntity {
  const AuditFacetEntity({required this.value, required this.count});
  final String value;
  final int count;
}

class AuditFacetActor {
  const AuditFacetActor({required this.id, this.name, required this.count});

  /// Uuid, o `sistema` para lo que no tiene autor.
  final String id;
  final String? name;
  final int count;

  bool get isSystem => id == 'sistema';
}

/// Opciones de los filtros (lo que existe en el registro).
class AuditFacets {
  const AuditFacets({this.actions = const [], this.entityTypes = const [], this.actors = const []});

  final List<AuditFacetAction> actions;
  final List<AuditFacetEntity> entityTypes;
  final List<AuditFacetActor> actors;

  factory AuditFacets.fromJson(Map<String, dynamic> j) => AuditFacets(
        actions: [
          for (final a in _maps(j['actions']))
            AuditFacetAction(
              value: '${a['value'] ?? ''}',
              label: _str(a['label']),
              count: _int(a['count']),
            ),
        ],
        entityTypes: [
          for (final e in _maps(j['entityTypes']))
            AuditFacetEntity(value: '${e['value'] ?? ''}', count: _int(e['count'])),
        ],
        actors: [
          for (final a in _maps(j['actors']))
            AuditFacetActor(id: '${a['id'] ?? ''}', name: _str(a['name']), count: _int(a['count'])),
        ],
      );
}

/// Una página de la lista.
class AuditPage {
  const AuditPage({required this.items, required this.page, required this.hasMore, this.facets});

  final List<AuditEntry> items;
  final int page;
  final bool hasMore;
  final AuditFacets? facets;

  factory AuditPage.fromJson(Map<String, dynamic> j) => AuditPage(
        items: [for (final e in _maps(j['items'])) AuditEntry.fromJson(e)],
        page: _int(j['page']) == 0 ? 1 : _int(j['page']),
        hasMore: j['hasMore'] == true,
        facets: j['facets'] is Map
            ? AuditFacets.fromJson(Map<String, dynamic>.from(j['facets'] as Map))
            : null,
      );
}

enum AuditPeriod {
  all('Todo el registro'),
  today('Hoy'),
  week('Últimos 7 días'),
  month('Últimos 30 días');

  const AuditPeriod(this.label);
  final String label;

  /// Desde cuándo (null = sin límite).
  DateTime? since(DateTime now) => switch (this) {
        AuditPeriod.all => null,
        AuditPeriod.today => DateTime(now.year, now.month, now.day),
        AuditPeriod.week => now.subtract(const Duration(days: 7)),
        AuditPeriod.month => now.subtract(const Duration(days: 30)),
      };
}

/// Filtros activos de la lista (inmutable).
class AuditFilters {
  const AuditFilters({
    this.q = '',
    this.entity,
    this.action,
    this.actor,
    this.period = AuditPeriod.all,
  });

  final String q;
  final String? entity;
  final String? action;
  final String? actor;
  final AuditPeriod period;

  AuditFilters copyWith({
    String? q,
    Object? entity = _keep,
    Object? action = _keep,
    Object? actor = _keep,
    AuditPeriod? period,
  }) =>
      AuditFilters(
        q: q ?? this.q,
        entity: identical(entity, _keep) ? this.entity : entity as String?,
        action: identical(action, _keep) ? this.action : action as String?,
        actor: identical(actor, _keep) ? this.actor : actor as String?,
        period: period ?? this.period,
      );

  /// Hay algo filtrado (además de la búsqueda).
  bool get hasChips => entity != null || action != null || actor != null || period != AuditPeriod.all;

  bool get isEmpty => q.trim().isEmpty && !hasChips;

  /// Parámetros de la consulta.
  Map<String, dynamic> toQuery(DateTime now) {
    final since = period.since(now);
    return {
      if (q.trim().isNotEmpty) 'q': q.trim(),
      'entity': ?entity,
      'action': ?action,
      'actor': ?actor,
      if (since != null) 'desde': since.toUtc().toIso8601String(),
    };
  }

  @override
  bool operator ==(Object other) =>
      other is AuditFilters &&
      other.q == q &&
      other.entity == entity &&
      other.action == action &&
      other.actor == actor &&
      other.period == period;

  @override
  int get hashCode => Object.hash(q, entity, action, actor, period);
}

const Object _keep = Object();
