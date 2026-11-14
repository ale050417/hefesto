import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/admin/admin_models.dart';
import '../../features/admin/sale_status.dart';
import '../config.dart';
import 'models.dart';

/// Error de la API con el contrato `{ error: { code, message } }`.
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.status});
  final String code;
  final String message;
  final int? status;

  bool get isUnauthorized => code == 'unauthorized';

  @override
  String toString() => message;
}

/// Cliente de `/api/v1`. Adjunta el JWT de Supabase (que supabase_flutter
/// refresca solo) y traduce los errores al contrato estable de la API.
class ApiClient {
  ApiClient()
      : _dio = Dio(
          BaseOptions(
            baseUrl: '${AppConfig.apiBaseUrl}/api/v1',
            connectTimeout: const Duration(seconds: 12),
            receiveTimeout: const Duration(seconds: 40),
            headers: {'Accept': 'application/json'},
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _accessToken();
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;

  /// Token vigente de la sesión (null = visitante). Si el guardado ya venció
  /// —la app volvió después de horas en segundo plano y supabase_flutter
  /// todavía no lo renovó— se renueva ANTES de mandar el pedido: sin esto la
  /// primera pantalla al volver mostraba "Tu sesión venció" (2026-11-14).
  Future<String?> _accessToken() async {
    final auth = Supabase.instance.client.auth;
    final session = auth.currentSession;
    if (session == null) return null;
    if (!session.isExpired) return session.accessToken;
    try {
      final refreshed = await auth.refreshSession();
      return refreshed.session?.accessToken ?? session.accessToken;
    } catch (_) {
      // Sin red o sesión revocada: el servidor responde 401 y la app lo muestra.
      return session.accessToken;
    }
  }

  /// Renueva la sesión después de un 401. `true` si quedó un token nuevo.
  Future<bool> _refreshAfterUnauthorized() async {
    try {
      final auth = Supabase.instance.client.auth;
      if (auth.currentSession == null) return false;
      final refreshed = await auth.refreshSession();
      return refreshed.session != null;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    Map<String, dynamic>? query,
  }) =>
      _send('GET', path, query: query);

  /// Llamada genérica a `/api/v1` para los módulos del panel: devuelve el JSON
  /// ya decodificado o lanza [ApiException] (con el mensaje en castellano que
  /// manda el servidor). Cada módulo arma sus propios métodos encima de esto.
  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);

  /// `method`: POST · PATCH · PUT · DELETE.
  Future<Map<String, dynamic>> sendJson(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
  }) =>
      _send(method, path, query: query, body: body);

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    bool retried = false,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        queryParameters: query,
        data: body,
        options: Options(method: method),
      );
      return res.data ?? {};
    } on DioException catch (e) {
      final error = _map(e);
      // Un 401 con sesión guardada casi siempre es el token vencido justo en
      // ese instante: se renueva y se reintenta UNA vez antes de avisar.
      if (error.isUnauthorized && !retried && await _refreshAfterUnauthorized()) {
        return _send(method, path, query: query, body: body, retried: true);
      }
      throw error;
    } on TypeError {
      // Respuesta que no es JSON (p. ej. una página HTML de error del hosting).
      throw ApiException('internal', 'El servidor respondió algo inesperado. Probá de nuevo.');
    }
  }

  ApiException _map(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      return ApiException(
        '${err['code'] ?? 'internal'}',
        '${err['message'] ?? 'Ocurrió un error.'}',
        status: e.response?.statusCode,
      );
    }
    if (e.response?.statusCode == 404) {
      // 404 sin el contrato de errores = la ruta no existe en ese servidor
      // (la web publicada todavía no tiene la API de la app).
      return ApiException(
        'not_deployed',
        'El servidor todavía no tiene esta función. Publicá la última versión de la web.',
        status: 404,
      );
    }
    final offline = e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout;
    return ApiException(
      offline ? 'offline' : 'internal',
      offline
          ? 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
          : 'Ocurrió un error inesperado. Probá de nuevo.',
      status: e.response?.statusCode,
    );
  }

  // --- Tienda pública ---

  Future<HomeData> home() async => HomeData.fromJson(await _get('/home'));

  Future<CatalogPage> products({
    String? q,
    String? category,
    String? material,
    double? minPrice,
    double? maxPrice,
    bool? onSale,
    bool? isNew,
    String sort = 'newest',
    int page = 1,
    int pageSize = 12,
    bool facets = false,
  }) async {
    final json = await _get('/products', query: {
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      'category': ?category,
      'material': ?material,
      'minPrice': ?minPrice,
      'maxPrice': ?maxPrice,
      if (onSale == true) 'onSale': 'true',
      if (isNew == true) 'isNew': 'true',
      'sort': sort,
      'page': page,
      'pageSize': pageSize,
      if (facets) 'facets': '1',
    });
    return CatalogPage.fromJson(json);
  }

  Future<({ProductDetail product, List<Product> related})> product(String slug) async {
    final json = await _get('/products/$slug');
    return (
      product: ProductDetail.fromJson(json['product'] as Map<String, dynamic>),
      related: ((json['related'] as List?) ?? [])
          .map((e) => Product.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  // --- Sesión ---

  Future<MeInfo> me() async => MeInfo.fromJson(await _get('/me'));

  /// Elimina la cuenta de quien inició sesión (la exigen App Store y Play
  /// Store). El servidor borra solo la cuenta del token; las del equipo
  /// responden `forbidden` con la explicación.
  Future<void> deleteAccount() async {
    await _send('DELETE', '/me');
  }

  // --- Panel de administración (requiere staff; el servidor lo verifica) ---

  Future<AdminDashboard> adminDashboard() async =>
      AdminDashboard.fromJson(await _get('/admin/dashboard'));

  Future<SalesPage> adminSales({
    String type = 'all',
    String? status,
    String q = '',
    int limit = 200,
  }) async =>
      SalesPage.fromJson(await _get('/admin/sales', query: {
        'type': type,
        'status': ?status,
        if (q.trim().isNotEmpty) 'q': q.trim(),
        'limit': limit,
      }));

  /// Detalle de una venta (`online` = pedido de la tienda, `manual` = mostrador).
  Future<SaleDetail> adminSale(String source, String id) async => source == 'manual'
      ? SaleDetail.manual(await _get('/admin/manual-sales/$id'))
      : SaleDetail.online(await _get('/admin/orders/$id'));

  Future<void> adminSetStatus(
    String source,
    String id,
    SaleStatus status, {
    String? note,
  }) async {
    await _send('POST', '/admin/sales/$source/$id/status', body: {
      'status': status.api,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }

  /// Código de seguimiento y/o nota interna de un pedido online. Un campo que
  /// no se manda no se toca; `''` lo borra.
  Future<void> adminOrderMeta(String id, {String? trackingCode, String? internalNote}) async {
    await _send('PATCH', '/admin/orders/$id', body: {
      'trackingCode': ?trackingCode,
      'internalNote': ?internalNote,
    });
  }

  Future<StockPage> adminFilaments() async =>
      StockPage.fromJson(await _get('/admin/filaments'));
}
