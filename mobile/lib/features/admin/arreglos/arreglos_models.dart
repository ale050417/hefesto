import '../filamentos/parse_util.dart';

/// Estado de un arreglo (`pending` → `in_progress` → `done` en la API).
enum FixStatus {
  pending('pending', 'Pendiente'),
  inProgress('in_progress', 'En curso'),
  done('done', 'Resuelto');

  const FixStatus(this.api, this.defaultLabel);

  /// Valor que viaja a la API.
  final String api;

  /// Rótulo si el servidor no manda el suyo (`statuses`).
  final String defaultLabel;

  /// Un estado que la app no conoce (versión vieja) cae a "pendiente": el
  /// arreglo se sigue viendo entre lo que falta resolver.
  static FixStatus parse(Object? v) =>
      values.firstWhere((s) => s.api == v, orElse: () => FixStatus.pending);
}

/// Algo que hay que arreglar o mejorar (fila de `/admin/arreglos`).
class Arreglo {
  const Arreglo({
    required this.id,
    required this.title,
    required this.description,
    required this.urgent,
    required this.status,
    required this.images,
    required this.author,
    required this.mine,
    this.ownerNote,
    this.createdAt,
    this.resolvedAt,
  });

  final String id;
  final String title;
  final String description;
  final bool urgent;
  final FixStatus status;

  /// Direcciones de las fotos ya subidas.
  final List<String> images;

  /// Respuesta del dueño (qué se hizo, o por qué no).
  final String? ownerNote;

  /// Quién lo cargó.
  final String author;

  /// Lo cargó quien está mirando (puede borrarlo mientras siga pendiente).
  final bool mine;
  final DateTime? createdAt;
  final DateTime? resolvedAt;

  bool get isDone => status == FixStatus.done;

  /// "Urgente" deja de marcarse cuando ya está resuelto.
  bool get showUrgent => urgent && !isDone;

  /// Regla del servidor: lo borra quien tiene `arreglos/eliminar`, o quien lo
  /// cargó mientras siga pendiente.
  bool deletableBy({required bool canDelete}) => canDelete || (mine && status == FixStatus.pending);

  factory Arreglo.fromJson(Map<String, dynamic> j) => Arreglo(
        id: strOf(j['id']),
        title: strOf(j['title']),
        description: strOf(j['description']),
        urgent: boolOf(j['urgent']),
        status: FixStatus.parse(j['status']),
        images: stringsOf(j['images']),
        ownerNote: strOrNull(j['ownerNote']),
        author: strOf(j['author'], 'Alguien del equipo'),
        mine: boolOf(j['mine']),
        createdAt: dateOf(j['createdAt']),
        resolvedAt: dateOf(j['resolvedAt']),
      );
}

/// Filtros del listado (chips).
enum FixFilter {
  open('Por resolver'),
  pending('Pendientes'),
  inProgress('En curso'),
  done('Resueltos'),
  all('Todos');

  const FixFilter(this.label);
  final String label;

  bool matches(Arreglo a) => switch (this) {
        FixFilter.open => !a.isDone,
        FixFilter.pending => a.status == FixStatus.pending,
        FixFilter.inProgress => a.status == FixStatus.inProgress,
        FixFilter.done => a.isDone,
        FixFilter.all => true,
      };
}

/// Todo lo que devuelve `GET /admin/arreglos`.
class ArreglosData {
  const ArreglosData({required this.items, required this.labels, required this.maxImages});

  final List<Arreglo> items;

  /// Rótulo de cada estado (los del servidor; si falta alguno, el de la app).
  final Map<FixStatus, String> labels;

  /// Tope de fotos por arreglo.
  final int maxImages;

  String labelOf(FixStatus s) => labels[s] ?? s.defaultLabel;

  int count(FixFilter f) => items.where(f.matches).length;

  factory ArreglosData.fromJson(Map<String, dynamic> j) {
    final raw = j['statuses'];
    final max = intOf(j['maxImages'], 6);
    return ArreglosData(
      items: [for (final m in mapsOf(j['items'])) Arreglo.fromJson(m)],
      labels: {
        for (final s in FixStatus.values)
          s: strOf(raw is Map ? raw[s.api] : null, s.defaultLabel),
      },
      maxImages: max > 0 ? max : 6,
    );
  }
}

/// Lo que se manda al cargar un arreglo.
class ArregloDraft {
  const ArregloDraft({required this.title, required this.description, required this.urgent});
  final String title;
  final String description;
  final bool urgent;

  Map<String, dynamic> toJson() => {
        'title': title.trim(),
        'description': description.trim(),
        'urgent': urgent,
      };
}

/// Validación del alta (mismas reglas que `fixCreateSchema` del servidor, que
/// igual vuelve a validar). Mapa campo → mensaje; vacío = válido.
Map<String, String> validateArregloForm({required String title, required String description}) {
  final errors = <String, String>{};
  final t = title.trim();
  final d = description.trim();
  if (t.length < 3) {
    errors['title'] = 'Poné un título corto (qué hay que arreglar).';
  } else if (t.length > 120) {
    errors['title'] = 'El título puede tener hasta 120 letras.';
  }
  if (d.length < 5) {
    errors['description'] = 'Explicá qué pasa y qué habría que cambiar.';
  } else if (d.length > 4000) {
    errors['description'] = 'La descripción puede tener hasta 4000 letras.';
  }
  return errors;
}

/// Cuerpo del PATCH: estado + respuesta del dueño (`null` la borra).
Map<String, dynamic> arregloUpdateJson(FixStatus status, String note) {
  final n = note.trim();
  return {'status': status.api, 'ownerNote': n.isEmpty ? null : n};
}
