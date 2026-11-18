// Apoyo para los tests que dibujan Ventas: un "hoy" fijo (la pantalla arranca
// en el mes actual, y los datos de ejemplo son de octubre de 2026) y los
// "Pendientes del equipo" de mentira (la entrada va arriba de la lista).

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_api.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_models.dart';
import 'package:hefesto/features/admin/sales_screen.dart';

/// Un pendiente con la forma real de `/api/v1/admin/pendientes`.
Map<String, dynamic> taskJson(
  String id, {
  String body = 'Cargar el pedido de Nico (2 llaveros)',
  bool done = false,
  String author = 'Agustín',
  bool mine = false,
  String createdAt = '2026-11-17T14:03:11.000Z',
  String? doneBy,
  String? doneAt,
}) =>
    {
      'id': id,
      'body': body,
      'done': done,
      'author': author,
      'mine': mine,
      'createdAt': createdAt,
      'doneBy': done ? (doneBy ?? 'Antonella') : null,
      'doneAt': done ? (doneAt ?? '2026-11-17T18:20:00.000Z') : null,
    };

/// JSON con la forma real de `GET /api/v1/admin/pendientes`.
Map<String, dynamic> pendientesJson() => {
      'open': [
        taskJson('t1', mine: true),
        taskJson('t2', body: 'Mandarle la cotización a Carla', author: 'Antonella'),
        taskJson('t3', body: 'Llamar al proveedor de filamento', author: 'Ale'),
      ],
      'done': [
        taskJson('t4', body: 'Avisarle a Pedro que está listo', done: true),
        taskJson('t5', body: 'Reponer bolsas', done: true, mine: true, doneBy: 'Ale'),
      ],
      'maxLength': 500,
    };

final samplePendientes = PendientesData.fromJson(pendientesJson());

/// API de mentira: guarda lo que la pantalla le manda y no toca la red.
class FakePendientesApi extends PendientesApi {
  FakePendientesApi([PendientesData? data])
      : data = data ?? samplePendientes,
        super(ApiClient());

  /// Lo que devuelve `list()` (se actualiza con cada cambio, como el servidor).
  PendientesData data;
  final created = <String>[];
  final toggled = <({String id, bool done})>[];
  final deleted = <String>[];
  Object? failWith;
  int lists = 0;

  @override
  Future<PendientesData> list() async {
    lists++;
    return data;
  }

  @override
  Future<TeamTask> create(String body) async {
    if (failWith != null) throw failWith!;
    created.add(body.trim());
    final task = TeamTask.fromJson(taskJson('nuevo-${created.length}', body: body.trim(), author: 'Ale', mine: true));
    data = PendientesData(open: [task, ...data.open], done: data.done, maxLength: data.maxLength);
    return task;
  }

  @override
  Future<TeamTask> setDone(String id, bool done) async {
    if (failWith != null) throw failWith!;
    toggled.add((id: id, done: done));
    final all = [...data.open, ...data.done];
    final t = all.firstWhere((x) => x.id == id);
    final moved = TeamTask(
      id: t.id,
      body: t.body,
      done: done,
      author: t.author,
      mine: t.mine,
      createdAt: t.createdAt,
      doneBy: done ? 'Ale' : null,
      doneAt: done ? DateTime(2026, 11, 17, 19) : null,
    );
    data = PendientesData(
      open: [if (!done) moved, ...data.open.where((x) => x.id != id)],
      done: [if (done) moved, ...data.done.where((x) => x.id != id)],
      maxLength: data.maxLength,
    );
    return moved;
  }

  @override
  Future<void> delete(String id) async {
    if (failWith != null) throw failWith!;
    deleted.add(id);
    data = PendientesData(
      open: data.open.where((x) => x.id != id).toList(),
      done: data.done.where((x) => x.id != id).toList(),
      maxLength: data.maxLength,
    );
  }
}

/// "Hoy" de los tests de Ventas: fin de octubre de 2026 al mediodía.
final salesTestNow = DateTime.utc(2026, 10, 31, 15);

/// Overrides para cualquier pantalla que muestre Ventas. Con [api] los
/// pendientes salen de esa API de mentira (y se pueden anotar/tildar/borrar).
List<Override> salesKitOverrides({DateTime? now, FakePendientesApi? api, PendientesData? pendientes}) => [
      salesNowProvider.overrideWithValue(() => now ?? salesTestNow),
      if (api != null)
        pendientesApiProvider.overrideWithValue(api)
      else
        pendientesProvider.overrideWith((ref) async => pendientes ?? samplePendientes),
    ];
