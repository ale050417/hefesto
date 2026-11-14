import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'audit_models.dart';

/// Acceso al servidor de Auditoría. Es una clase aparte (y no llamadas sueltas
/// al cliente) para poder reemplazarla en los tests sin red.
abstract class AuditApi {
  Future<AuditPage> fetch(AuditFilters filters, {int page = 1, bool facets = false});
  Future<AuditEntry> detail(String id);
}

class HttpAuditApi implements AuditApi {
  HttpAuditApi(this._client);
  final ApiClient _client;

  static const pageSize = 30;

  @override
  Future<AuditPage> fetch(AuditFilters filters, {int page = 1, bool facets = false}) async {
    final json = await _client.getJson('/admin/auditoria', query: {
      ...filters.toQuery(DateTime.now()),
      'page': page,
      'pageSize': pageSize,
      if (facets) 'facets': '1',
    });
    return AuditPage.fromJson(json);
  }

  @override
  Future<AuditEntry> detail(String id) async {
    final json = await _client.getJson('/admin/auditoria/$id');
    return AuditEntry.fromJson(Map<String, dynamic>.from(json['entry'] as Map));
  }
}

final auditApiProvider = Provider<AuditApi>((ref) => HttpAuditApi(ref.watch(apiClientProvider)));

/// Estado de la lista paginada.
class AuditListState {
  const AuditListState({
    this.items = const [],
    this.filters = const AuditFilters(),
    this.page = 0,
    this.hasMore = false,
    this.loading = true,
    this.loadingMore = false,
    this.error,
    this.moreError,
    this.facets,
  });

  final List<AuditEntry> items;
  final AuditFilters filters;

  /// Última página cargada (0 = ninguna todavía).
  final int page;
  final bool hasMore;

  /// Cargando la primera página (o recargando por un filtro nuevo).
  final bool loading;
  final bool loadingMore;

  /// Falló la primera página.
  final String? error;

  /// Falló "cargar más" (la lista que ya había se conserva).
  final String? moreError;
  final AuditFacets? facets;

  AuditListState copyWith({
    List<AuditEntry>? items,
    AuditFilters? filters,
    int? page,
    bool? hasMore,
    bool? loading,
    bool? loadingMore,
    Object? error = _keep,
    Object? moreError = _keep,
    AuditFacets? facets,
  }) =>
      AuditListState(
        items: items ?? this.items,
        filters: filters ?? this.filters,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
        error: identical(error, _keep) ? this.error : error as String?,
        moreError: identical(moreError, _keep) ? this.moreError : moreError as String?,
        facets: facets ?? this.facets,
      );
}

const Object _keep = Object();

String _msg(Object e) => e is ApiException ? e.message : 'No pudimos cargar el registro. Probá de nuevo.';

/// Controla la lista: primera página, "cargar más" y cambios de filtro. Si
/// llega una respuesta vieja (el usuario ya cambió el filtro) se descarta.
class AuditListController extends Notifier<AuditListState> {
  int _seq = 0;

  @override
  AuditListState build() {
    // Arranca solo; el estado inicial ya dice "cargando".
    Future.microtask(() => _loadFirst(const AuditFilters()));
    return const AuditListState();
  }

  AuditApi get _api => ref.read(auditApiProvider);

  Future<void> _loadFirst(AuditFilters filters) async {
    final seq = ++_seq;
    state = state.copyWith(filters: filters, loading: true, loadingMore: false, error: null, moreError: null);
    try {
      // Las opciones de filtro se piden una sola vez (primera carga).
      final page = await _api.fetch(filters, page: 1, facets: state.facets == null);
      if (seq != _seq) return;
      state = state.copyWith(
        items: page.items,
        page: 1,
        hasMore: page.hasMore,
        loading: false,
        facets: page.facets,
      );
    } catch (e) {
      if (seq != _seq) return;
      state = state.copyWith(items: const [], loading: false, error: _msg(e), hasMore: false, page: 0);
    }
  }

  /// Vuelve a pedir desde la primera página (pull-to-refresh, "Reintentar").
  Future<void> refresh() => _loadFirst(state.filters);

  /// Aplica filtros nuevos y recarga.
  Future<void> setFilters(AuditFilters filters) {
    if (filters == state.filters && state.error == null) return Future.value();
    return _loadFirst(filters);
  }

  Future<void> loadMore() async {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    final seq = _seq;
    state = state.copyWith(loadingMore: true, moreError: null);
    try {
      final next = state.page + 1;
      final page = await _api.fetch(state.filters, page: next);
      if (seq != _seq) return;
      // Si entraron eventos nuevos mientras tanto, la paginación por offset
      // puede repetir alguno: se descarta por id.
      final seen = {for (final e in state.items) e.id};
      state = state.copyWith(
        items: [...state.items, ...page.items.where((e) => !seen.contains(e.id))],
        page: next,
        hasMore: page.hasMore,
        loadingMore: false,
      );
    } catch (e) {
      if (seq != _seq) return;
      state = state.copyWith(loadingMore: false, moreError: _msg(e));
    }
  }
}

final auditListProvider =
    NotifierProvider.autoDispose<AuditListController, AuditListState>(AuditListController.new);

/// Detalle de un evento (la lista ya trae casi todo; esto refresca y suma el rol).
final auditDetailProvider = FutureProvider.autoDispose.family<AuditEntry, String>(
  (ref, id) => ref.watch(auditApiProvider).detail(id),
  retry: (_, _) => null,
);
