// "Pendientes del equipo" (pedido de Agustín, 2026-11-17): lista compartida de
// lo que falta hacer (un pedido sin cargar, una cotización por mandar…). Mismos
// datos que la tarjeta de Pedidos de la web (`/api/v1/admin/pendientes`).

import '../filamentos/parse_util.dart';

/// Un pendiente anotado por alguien del equipo.
class TeamTask {
  const TeamTask({
    required this.id,
    required this.body,
    required this.done,
    required this.author,
    required this.mine,
    this.createdAt,
    this.doneBy,
    this.doneAt,
  });

  final String id;
  final String body;
  final bool done;

  /// Quién lo anotó.
  final String author;

  /// Lo anotó quien está mirando (puede borrarlo).
  final bool mine;
  final DateTime? createdAt;

  /// Quién lo tildó (null mientras siga abierto).
  final String? doneBy;
  final DateTime? doneAt;

  /// Regla del servidor: lo borra quien lo anotó o quien tiene pedidos/eliminar.
  bool deletableBy({required bool canDelete}) => mine || canDelete;

  factory TeamTask.fromJson(Map<String, dynamic> j) => TeamTask(
        id: strOf(j['id']),
        body: strOf(j['body']),
        done: boolOf(j['done']),
        author: strOf(j['author'], 'Alguien del equipo'),
        mine: boolOf(j['mine']),
        createdAt: dateOf(j['createdAt']),
        doneBy: strOrNull(j['doneBy']),
        doneAt: dateOf(j['doneAt']),
      );
}

/// Todo lo que devuelve `GET /admin/pendientes`.
class PendientesData {
  const PendientesData({required this.open, required this.done, this.maxLength = 500});

  /// Sin tildar, los más nuevos primero.
  final List<TeamTask> open;

  /// Los últimos tildados (el servidor manda hasta 20).
  final List<TeamTask> done;

  /// Largo máximo del texto de un pendiente.
  final int maxLength;

  factory PendientesData.fromJson(Map<String, dynamic> j) {
    final max = intOf(j['maxLength'], 500);
    List<TeamTask> list(Object? raw) => [
          for (final m in mapsOf(raw))
            if (strOf(m['id']).isNotEmpty) TeamTask.fromJson(m),
        ];
    return PendientesData(
      open: list(j['open']),
      done: list(j['done']),
      maxLength: max > 0 ? max : 500,
    );
  }
}

/// Texto de la entrada en Ventas: "Pendientes del equipo · 3" (sin número
/// mientras no se sepa cuántos hay).
String pendientesEntryLabel(int? openCount) =>
    openCount == null ? 'Pendientes del equipo' : 'Pendientes del equipo · $openCount';

/// "Nada pendiente" / "1 pendiente" / "3 pendientes" (igual que la web).
String pendientesCountLabel(int openCount) => switch (openCount) {
      0 => 'Nada pendiente',
      1 => '1 pendiente',
      _ => '$openCount pendientes',
    };

/// Validación del texto antes de mandarlo (mismas reglas que el servidor).
/// Devuelve el mensaje de error, o null si está bien.
String? validateTaskBody(String text, {int maxLength = 500}) {
  final t = text.trim();
  if (t.isEmpty) return 'Escribí el pendiente.';
  if (t.length > maxLength) return 'Máximo $maxLength caracteres.';
  return null;
}
