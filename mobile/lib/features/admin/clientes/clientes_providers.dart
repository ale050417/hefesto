import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'clientes_models.dart';

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar".
Duration? _noRetry(int count, Object error) => null;

/// Toda la lista de clientes (la búsqueda y el nivel se filtran en el celu).
final adminCustomersProvider = FutureProvider.autoDispose<CustomersPage>(
  (ref) async => CustomersPage.fromJson(
    await ref.watch(apiClientProvider).getJson('/admin/clientes'),
  ),
  retry: _noRetry,
);

/// Ficha de un cliente: datos, pedidos y puntos.
final adminCustomerProvider = FutureProvider.autoDispose.family<CustomerDetail, String>(
  (ref, id) async => CustomerDetail.fromJson(
    await ref.watch(apiClientProvider).getJson('/admin/clientes/$id'),
  ),
  retry: _noRetry,
);

/// Tras crear o editar un cliente, la lista y las fichas quedan viejas.
void invalidateCustomers(WidgetRef ref) {
  ref.invalidate(adminCustomersProvider);
  ref.invalidate(adminCustomerProvider);
}

/// Datos que se mandan al crear o editar un cliente manual.
Map<String, dynamic> customerBody({
  required String name,
  String email = '',
  String phone = '',
  String city = '',
  String note = '',
}) =>
    {
      'name': name.trim(),
      'email': email.trim(),
      'phone': phone.trim(),
      'city': city.trim(),
      'note': note.trim(),
    };

/// Alta de un cliente manual. Devuelve su id.
Future<String> createCustomer(ApiClient api, Map<String, dynamic> body) async {
  final res = await api.sendJson('POST', '/admin/clientes', body: body);
  return '${res['id'] ?? ''}';
}

/// Edición de un cliente manual.
Future<void> updateCustomer(ApiClient api, String id, Map<String, dynamic> body) async {
  await api.sendJson('PATCH', '/admin/clientes/$id', body: body);
}

/// Nota interna de cualquier cliente (vacía = la borra).
Future<void> saveCustomerNote(ApiClient api, Customer customer, String note) async {
  await api.sendJson(
    'PUT',
    '/admin/clientes/${customer.id}/nota',
    body: {'source': customer.source, 'note': note.trim()},
  );
}
