// Pruebas "teléfono real" del grupo VENTAS del panel (2026-11-14, pedido de
// Ale: que ninguna pantalla ni modal se vea roto en el celular): contenedor
// del panel con su barra inferior, Inicio, Ventas, Consultas, detalle de una venta (con
// TODAS sus acciones), Nueva venta de mostrador, Editar venta y "Más".
//
// Cada cosa se dibuja en el teléfono más chico (360×640 con barra de tres
// botones) y en un iPhone con notch, con el teclado abierto donde hay campos,
// con letra 1,3× y en los tres temas. Los modales se abren por el camino real
// (tocando el botón de la pantalla).
// Con SHOT_DIR=carpeta guarda una captura de cada paso.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/core/widgets/file_attach.dart';
import 'package:hefesto/core/widgets/photo_gallery.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_modules.dart';
import 'package:hefesto/features/admin/admin_more_screen.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/admin_shell.dart';
import 'package:hefesto/features/admin/admin_widgets.dart';
import 'package:hefesto/features/admin/calculadora/price_estimator_sheet.dart';
import 'package:hefesto/features/admin/consultas/consulta_answer_screen.dart';
import 'package:hefesto/features/admin/consultas/consulta_form_screen.dart';
import 'package:hefesto/features/admin/consultas/consultas_api.dart';
import 'package:hefesto/features/admin/consultas/consultas_models.dart';
import 'package:hefesto/features/admin/consultas/consultas_screen.dart';
import 'package:hefesto/features/admin/dashboard_screen.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_models.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_screen.dart';
import 'package:hefesto/features/admin/produccion/produccion_api.dart';
import 'package:hefesto/features/admin/produccion/produccion_models.dart';
import 'package:hefesto/features/admin/produccion/produccion_screen.dart';
import 'package:hefesto/features/admin/sale_detail_screen.dart';
import 'package:hefesto/features/admin/sale_status.dart';
import 'package:hefesto/features/admin/sales_screen.dart';
import 'package:hefesto/features/admin/stock_screen.dart';
import 'package:hefesto/features/admin/ventas_extra/ventas_extra_api.dart';
import 'package:hefesto/features/admin/ventas_extra/ventas_extra_models.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session, User;

import 'admin_consultas_models_test.dart' show answeredJson, inquiryJson;
import 'admin_consultas_screens_test.dart' show FakeConsultasApi;
import 'support/calc_kit.dart';
import 'support/device_kit.dart';
import 'support/notifications_kit.dart';
import 'support/photo_kit.dart';
import 'support/sales_kit.dart';

// ---------------------------------------------------------------------------
// Datos de ejemplo (misma forma que devuelve /api/v1/admin/*)
// ---------------------------------------------------------------------------

const _allModules = [
  'pedidos', 'filamentos', 'clientes', 'consultas', 'produccion', 'fallas', 'arreglos', 'productos', 'descuentos',
  'recompensas', 'reportes', 'ganancias', 'calculadora', 'config', 'auditoria',
];

final _admin = staffWith(_allModules);
final _operator = staffWith(['pedidos', 'filamentos'], role: 'operator', actions: const ['ver', 'editar']);
final _readOnly = staffWith(['pedidos', 'filamentos'], role: 'operator', actions: const ['ver']);

final _session = Session(
  accessToken: 'token-de-prueba',
  tokenType: 'bearer',
  user: const User(
    id: 'u1',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-01-01T00:00:00.000Z',
  ),
);

const _longName = 'María Fernanda de los Ángeles Rodríguez Etcheverry de la Fuente y Santillán';
const _longProduct =
    'Lámpara articulada de escritorio con base hexagonal, difusor translúcido y grabado personalizado con nombre y logo del club';
const _longCategory = 'Regalos empresariales y souvenirs personalizados';

Map<String, dynamic> _filament(String id, String color, String? hex, num stock, String status) => {
      'id': id,
      'material': 'PLA',
      'color': color,
      'brand': 'Grilon3',
      'diameter': '1.75',
      'stockGrams': stock,
      'spoolGrams': 1000,
      'costPerKg': 20000,
      'alertThresholdGrams': 200,
      'lowStock': status != 'ok',
      'status': status,
      'hex': hex,
    };

Map<String, dynamic> _order(String id, String n, String? who, String status, num total, String items, int daysAgo) => {
      'id': id,
      'orderNumber': n,
      'customerName': who,
      'paymentMethod': 'transfer',
      'total': total,
      'status': status,
      'createdAt': DateTime(2026, 10, 31, 15).subtract(Duration(days: daysAgo)).toIso8601String(),
      'updatedAt': DateTime(2026, 10, 31).toIso8601String(),
      'itemsSummary': items,
    };

List<Map<String, dynamic>> _series({num scale = 1}) => [
      for (var i = 29; i >= 0; i--)
        {
          'date': DateTime(2026, 10, 31).subtract(Duration(days: i)).toIso8601String().substring(0, 10),
          'total': (i * 7919) % 5 == 0 ? 0 : (8000 + ((i * 7919) % 40) * 1500) * scale,
        },
    ];

final _dashboard = AdminDashboard.fromJson({
  'greetingName': 'Ale',
  'kpis': {'revenue': 1250000, 'salesCount': 48, 'pendingCount': 3, 'lowStockCount': 2},
  'revenueSeries': _series(),
  'last7': 98500,
  'last30': 612000,
  'counts': {'pendingPayment': 3, 'inProduction': 5, 'ready': 1},
  'statusCounts': {'pending_payment': 3, 'confirmed': 2, 'in_production': 3, 'ready': 1},
  'recentOrders': [
    _order('o1', 'HF-0042', 'Juan Pérez', 'in_production', 57500, 'Mate Mario · Cartel ×2', 1),
    _order('o2', 'HF-0041', null, 'pending_payment', 32500, 'Cartel Personalizado', 2),
    _order('o3', 'HF-0040', 'Ana Gómez', 'delivered', 110000, 'Tony Tony Chopper Tamaño Real', 4),
  ],
  'lowStock': [
    _filament('f1', 'Rojo', '#CC2200', 120, 'bajo'),
    _filament('f2', 'Negro', '#111111', 0, 'agotado'),
  ],
  'degraded': <String>[],
});

/// Todo al límite: montos de 9 cifras, nombres larguísimos, muchas alertas y
/// el aviso de datos parciales.
final _dashboardExtreme = AdminDashboard.fromJson({
  'greetingName': 'Maximiliano-Alexander',
  'kpis': {'revenue': 987654321, 'salesCount': 123456, 'pendingCount': 987, 'lowStockCount': 128},
  'revenueSeries': _series(scale: 9000),
  'last7': 345678901,
  'last30': 987654321,
  'counts': {'pendingPayment': 987, 'inProduction': 1234, 'ready': 456},
  'statusCounts': {'pending_payment': 987, 'confirmed': 234, 'in_production': 1000, 'ready': 456},
  'recentOrders': [
    _order('o1', 'HEF-2026-000042', _longName, 'ready', 987654321, _longProduct, 1),
    _order('o2', 'HEF-2026-000041', null, 'pending_payment', 123456789, '', 2),
    for (var i = 0; i < 4; i++)
      _order('x$i', 'HEF-2026-00003$i', 'Cliente $i', 'refunded', 4500 + i, 'Llavero ×${i + 1}', 3 + i),
  ],
  'lowStock': [
    _filament('f1', 'Verde kriptonita fluorescente edición limitada', '#33FF66', 12, 'bajo'),
    _filament('f2', 'Negro', null, 0, 'agotado'),
    for (var i = 0; i < 6; i++) _filament('g$i', 'Color $i', '#44${i}5AA', 50.0 + i, 'bajo'),
  ],
  'degraded': ['los KPIs', 'las ventas manuales', 'el stock de filamentos'],
});

final _dashboardEmpty = AdminDashboard.fromJson({
  'greetingName': null,
  'kpis': {'revenue': 0, 'salesCount': 0, 'pendingCount': 0, 'lowStockCount': 0},
  'revenueSeries': <dynamic>[],
  'last7': 0,
  'last30': 0,
  'counts': {'pendingPayment': 0, 'inProduction': 0, 'ready': 0},
  'recentOrders': <dynamic>[],
  'lowStock': <dynamic>[],
  'degraded': <String>[],
});

Map<String, dynamic> _row(
  String id, {
  String source = 'online',
  String? who = 'Juan Pérez',
  String label = 'Mate Mario · Cartel ×2',
  String? ref = 'HF-0042',
  String status = 'in_production',
  num total = 57500,
  int day = 30,
}) =>
    {
      'id': id,
      'source': source,
      'date': '2026-10-${day.toString().padLeft(2, '0')}T15:00:00.000Z',
      'customerName': who,
      'label': label,
      'ref': source == 'manual' ? null : ref,
      'paymentMethod': 'mercadopago',
      'status': status,
      'total': total,
    };

final _salesJson = [
  _row('a'),
  _row('b', source: 'manual', who: 'Cliente de feria', label: '5 llaveros', status: 'delivered', total: 10000, day: 29),
  _row('c', who: null, label: '', ref: 'HF-0039', status: 'pending_payment', total: 32500, day: 28),
  _row('d', who: 'Ana', label: 'Figura', ref: 'HF-0038', status: 'cancelled', total: 4500, day: 27),
];

final _sales = SalesPage.fromJson({'total': 4, 'items': _salesJson});

/// Ventas de tres meses: octubre (el "hoy" de las pruebas), septiembre y
/// agosto, con dos sin cerrar de meses anteriores y una del 31/10 a las 22:30
/// de Argentina (ya es noviembre en UTC).
final _salesMonths = SalesPage.fromJson({
  'total': 8,
  'items': [
    {..._row('n1', who: 'Nocturna del 31', ref: 'HF-0050', status: 'confirmed'), 'date': '2026-11-01T01:30:00.000Z'},
    ..._salesJson,
    {..._row('s1', who: 'Carla', ref: 'HF-0020', status: 'in_production'), 'date': '2026-09-12T15:00:00.000Z'},
    {..._row('s2', who: 'Pedro', ref: 'HF-0019', status: 'delivered'), 'date': '2026-09-03T15:00:00.000Z'},
    {..._row('g1', who: _longName, label: _longProduct, ref: 'HF-0007', status: 'pending_payment'), 'date': '2026-08-05T15:00:00.000Z'},
  ],
});

/// 40 ventas con textos largos y montos enormes (y más en el servidor).
final _salesMany = SalesPage.fromJson({
  'total': 350,
  'items': [
    for (var i = 0; i < 40; i++)
      _row(
        'v$i',
        source: i.isEven ? 'online' : 'manual',
        who: i % 3 == 0 ? _longName : 'Cliente $i',
        label: i % 4 == 0 ? _longProduct : 'Producto $i',
        ref: 'HEF-2026-0000$i',
        status: SaleStatus.values[i % SaleStatus.values.length].api,
        total: i % 5 == 0 ? 987654321 : 1500 * (i + 1),
        day: 1 + (i % 28),
      ),
  ],
});

const _address = {
  'fullName': 'Juan Pérez',
  'phone': '+54 3757 624148',
  'street': 'Av. Siempreviva 742',
  'city': 'Posadas',
  'province': 'Misiones',
  'postalCode': '3300',
  'zone': 'Centro',
  'deliveryType': 'local',
  'notes': 'Dejar con el vecino si no estoy',
};

SaleDetail _online({
  String status = 'ready',
  String? tracking,
  String? note = 'Pidió que el rojo sea más oscuro',
  String? cancelReason,
}) =>
    SaleDetail.online({
      'id': 'o1',
      'orderNumber': 'HF-0042',
      'status': status,
      'paymentMethod': 'mercadopago',
      'subtotal': 60000,
      'discountAmount': 5000,
      'shippingCost': 2500,
      'total': 57500,
      'shippingAddress': _address,
      'trackingCode': tracking,
      'internalNote': note,
      'cancelReason': cancelReason,
      'createdAt': '2026-10-30T15:00:00.000Z',
      'paidAt': status == 'pending_payment' ? null : '2026-10-30T15:05:00.000Z',
      'customer': {'fullName': 'Juan Pérez', 'phone': '+54 3757 624148'},
      'items': [
        {'id': 'i1', 'productName': 'Mate Mario', 'variantLabel': 'Rojo', 'unitPrice': 30000, 'quantity': 2, 'lineTotal': 60000},
      ],
      'history': [
        {'fromStatus': null, 'toStatus': 'pending_payment', 'note': 'Pedido creado', 'createdAt': '2026-10-30T15:00:00.000Z'},
        {'fromStatus': 'pending_payment', 'toStatus': 'confirmed', 'note': 'Pago acreditado por MercadoPago', 'createdAt': '2026-10-30T15:05:00.000Z'},
        {'fromStatus': 'confirmed', 'toStatus': 'in_production', 'note': null, 'createdAt': '2026-10-30T18:00:00.000Z'},
        {'fromStatus': 'in_production', 'toStatus': 'ready', 'note': null, 'createdAt': '2026-10-31T09:00:00.000Z'},
      ],
    });

/// Pedido con todo largo: cliente, dirección, 14 productos, notas e historial.
final _onlineExtreme = SaleDetail.online({
  'id': 'o9',
  'orderNumber': 'HEF-2026-000042',
  'status': 'ready',
  'paymentMethod': 'mercadopago',
  'subtotal': 987654321,
  'discountAmount': 123456789,
  'shippingCost': 98765432,
  'total': 962962964,
  'shippingAddress': {
    'fullName': _longName,
    'phone': '+54 9 3757 62-4148 interno 4521',
    'street': 'Avenida Presidente Doctor Arturo Umberto Illia 12345, torre B, piso 14, departamento 1402',
    'city': 'San Fernando del Valle de Catamarca',
    'province': 'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
    'postalCode': 'K4700XAA',
    'deliveryType': 'national',
    'notes': 'Tocar el timbre del encargado, dejar en portería si no hay nadie y avisar por WhatsApp antes de salir, gracias.',
  },
  'trackingCode': null,
  'internalNote': null,
  'cancelReason': null,
  'createdAt': '2026-10-30T15:00:00.000Z',
  'paidAt': '2026-10-30T15:05:00.000Z',
  'customer': {'fullName': _longName, 'phone': '+54 9 3757 62-4148 interno 4521'},
  'items': [
    for (var i = 0; i < 14; i++)
      {
        'id': 'i$i',
        'productName': i.isEven ? _longProduct : 'Llavero $i',
        'variantLabel': i % 3 == 0 ? 'Blanco + Celeste + Dorado + Marrón + Negro + Piel + Verde kriptonita + Verde manzana' : null,
        'unitPrice': 98765432,
        'quantity': 9999,
        'lineTotal': 987654321,
      },
  ],
  'history': [
    for (var i = 0; i < 9; i++)
      {
        'fromStatus': i == 0 ? null : 'confirmed',
        'toStatus': SaleStatus.flow[i % SaleStatus.flow.length].api,
        'note': i.isEven
            ? 'El cliente llamó para pedir que el envío salga recién la semana que viene porque está de viaje y no hay nadie en la casa.'
            : null,
        'createdAt': '2026-10-${(10 + i).toString()}T15:00:00.000Z',
      },
  ],
});

/// Pedido con casi todo vacío (campos nulos).
final _onlineBare = SaleDetail.online({
  'id': 'o7',
  'orderNumber': null,
  'status': 'pending_payment',
  'paymentMethod': null,
  'subtotal': 0,
  'discountAmount': 0,
  'shippingCost': 0,
  'total': 0,
  'shippingAddress': null,
  'trackingCode': null,
  'internalNote': null,
  'cancelReason': null,
  'createdAt': '2026-10-30T15:00:00.000Z',
  'paidAt': null,
  'customer': null,
  'items': <dynamic>[],
  'history': <dynamic>[],
});

SaleDetail _manual({String status = 'delivered', String? cancelReason, String who = 'Cliente de feria', String? category = 'Llaveros'}) =>
    SaleDetail.manual({
      'id': 'm1',
      'saleDate': '2026-10-29T12:00:00.000Z',
      'customerName': who,
      'detail': '5 llaveros',
      'category': category,
      'status': status,
      'paymentMethod': 'cash',
      'quantity': 5,
      'total': 10000,
      'cancelReason': cancelReason,
      'items': <dynamic>[],
    });

ManualSaleEditData _editData({String who = 'Cliente de feria', String? detail = '5 llaveros personalizados', num total = 10000}) =>
    ManualSaleEditData.fromJson({
      'id': 'm1',
      'saleDate': '2026-10-29T12:00:00.000Z',
      'customerName': who,
      'detail': detail,
      'category': 'Llaveros',
      'status': 'delivered',
      'paymentMethod': 'cash',
      'quantity': 5,
      'total': total,
      'amortization': 3500,
      'profit': 6500,
      'items': <dynamic>[],
    });

final _formData = SaleFormData.fromJson({
  'categories': ['Llaveros', 'Mates', 'Porta sahumerios'],
  'recentCustomers': ['Juan Pérez', 'Ana Gómez', 'Cliente de feria'],
});

final _formDataExtreme = SaleFormData.fromJson({
  'categories': [_longCategory, for (var i = 0; i < 14; i++) 'Categoría número $i'],
  'recentCustomers': [_longName, for (var i = 0; i < 12; i++) 'Cliente anterior $i'],
});

Map<String, dynamic> _mate() => {
      'id': 'p1',
      'name': 'Mate Mario',
      'categoryName': 'Mates',
      'price': 30000,
      'colorMode': 'single',
      'colors': [
        {'name': 'Rojo', 'hex': '#CC2200'},
        {'name': 'Blanco', 'hex': '#F2F2F2'},
        {'name': 'Verde militar', 'hex': null},
      ],
      'variants': ['Chico', 'Grande'],
      'options': [
        for (final v in ['Chico', 'Grande'])
          for (final c in ['Rojo', 'Blanco', 'Verde militar'])
            {
              'variantLabel': v,
              'color': c,
              'unitPrice': v == 'Chico' ? 30000 : 45000,
              'weightGrams': v == 'Chico' ? 120 : 250,
              'extrasCost': 0,
              'hasStock': c != 'Verde militar',
            },
      ],
    };

final _catalog = SaleCatalogPage.fromJson({
  'total': 3,
  'items': [
    _mate(),
    {
      'id': 'p2',
      'name': 'Llavero personalizado con nombre y color a elección del cliente',
      'categoryName': 'Porta sahumerios',
      'price': 2500,
      'colorMode': 'single',
      'colors': [
        {'name': 'Negro', 'hex': '#111111'},
      ],
      'variants': <dynamic>[],
      'options': [
        {'variantLabel': null, 'color': 'Negro', 'unitPrice': 2500, 'weightGrams': 8, 'extrasCost': 100, 'hasStock': true},
      ],
    },
    {
      'id': 'p3',
      'name': 'Cartel a medida',
      'categoryName': null,
      'price': 12000,
      'colorMode': 'multi',
      'colors': <dynamic>[],
      'variants': <dynamic>[],
      'options': [
        {'variantLabel': null, 'color': null, 'unitPrice': 12000, 'weightGrams': 0, 'extrasCost': 0, 'hasStock': false},
      ],
    },
  ],
});

const _manyVariants = [
  'Chico',
  'Mediano',
  'Grande',
  'Extra grande (edición coleccionista numerada)',
  'Combo familiar: 2 mates grandes + 2 bombillas + 1 yerbera + 1 azucarera',
  'Mate + bombilla',
  'Mate + bombilla + estuche',
  'Solo estuche',
  'Mini',
  'Gigante',
  'Llavero',
  'Imán',
];

const _manyColors = [
  ('Rojo', '#CC2200'),
  ('Blanco', '#F2F2F2'),
  ('Negro', '#111111'),
  ('Verde kriptonita fluorescente', '#33FF66'),
  ('Azul Francia', '#1F4FD8'),
  ('Amarillo', '#FFD400'),
  ('Dorado seda', '#C9A84C'),
  ('Piel', '#E8B796'),
  ('Marrón', '#6B3F1D'),
  ('Celeste', '#7EC8E3'),
  ('Violeta', '#7A3DB8'),
  ('Naranja', '#FF7A00'),
  ('Gris plata', '#A9A9B0'),
  ('Transparente', null),
];

/// 36 productos (de 57): nombres y categorías largas, precios de 9 cifras, y
/// el primero con 12 tamaños y 14 colores.
final _catalogMany = SaleCatalogPage.fromJson({
  'total': 57,
  'items': [
    {
      'id': 'big',
      'name': 'Set de mates personalizados con nombre, logo del club y estuche rígido de regalo',
      'categoryName': _longCategory,
      'price': 987654321,
      'colorMode': 'single',
      'colors': [
        for (final c in _manyColors) {'name': c.$1, 'hex': c.$2},
      ],
      'variants': _manyVariants,
      'options': [
        for (final v in _manyVariants)
          for (final c in _manyColors)
            {
              'variantLabel': v,
              'color': c.$1,
              'unitPrice': v == 'Chico' ? 123456789 : 987654321,
              'weightGrams': 1250.5,
              'extrasCost': 0,
              'hasStock': c.$1 != 'Transparente',
            },
      ],
    },
    for (var i = 0; i < 35; i++)
      {
        'id': 'q$i',
        'name': i % 3 == 0 ? '$_longProduct $i' : 'Producto $i',
        'categoryName': i % 4 == 0 ? _longCategory : (i % 4 == 1 ? null : 'Porta sahumerios'),
        'price': i % 5 == 0 ? 987654321 : 2500 + i,
        'colorMode': i % 6 == 0 ? 'multi' : 'single',
        'colors': i % 6 == 0
            ? <dynamic>[]
            : [
                {'name': 'Negro', 'hex': '#111111'},
              ],
        'variants': i % 2 == 0 ? ['Chico', 'Grande'] : <dynamic>[],
        'options': [
          {
            'variantLabel': i % 2 == 0 ? 'Chico' : null,
            'color': i % 6 == 0 ? null : 'Negro',
            'unitPrice': i % 5 == 0 ? 123456789 : 2500 + i,
            'weightGrams': 8,
            'extrasCost': 0,
            'hasStock': i % 7 != 0,
          },
          if (i % 2 == 0)
            {
              'variantLabel': 'Grande',
              'color': i % 6 == 0 ? null : 'Negro',
              'unitPrice': i % 5 == 0 ? 987654321 : 4500 + i,
              'weightGrams': 16,
              'extrasCost': 0,
              'hasStock': i % 7 != 0,
            },
        ],
      },
  ],
});

final _stock = StockPage.fromJson({
  'counts': {'total': 12, 'low': 1, 'out': 1},
  'items': [
    _filament('1', 'Blanco', '#F2F2F2', 840, 'ok'),
    _filament('2', 'Rojo', '#CC2200', 120, 'bajo'),
    _filament('3', 'Negro', '#111111', 0, 'agotado'),
    for (var i = 0; i < 9; i++) _filament('s$i', 'Color $i', '#4455AA', 500 + i, 'ok'),
  ],
});

// ---------------------------------------------------------------------------
// APIs falsas
// ---------------------------------------------------------------------------

/// El cliente de la API, falso: anota los cambios de estado / notas que le
/// piden y puede fallar a pedido. Nunca toca la red.
class _FakeClient extends ApiClient {
  final calls = <String>[];
  Object? failStatus;
  Object? failMeta;

  @override
  Future<void> adminSetStatus(String source, String id, SaleStatus status, {String? note}) async {
    if (failStatus != null) throw failStatus!;
    calls.add('estado $source/$id → ${status.api}${note == null || note.trim().isEmpty ? '' : ' (${note.trim()})'}');
  }

  @override
  Future<void> adminOrderMeta(String id, {String? trackingCode, String? internalNote}) async {
    if (failMeta != null) throw failMeta!;
    calls.add('meta $id tracking=${trackingCode ?? '∅'} nota=${internalNote ?? '∅'}');
  }
}

/// La API de carga / edición / baja de ventas, falsa.
class _FakeVentas implements VentasExtraApi {
  Map<String, dynamic>? created;
  Map<String, dynamic>? edited;
  String? deletedManual;
  String? deletedOrder;
  Object? failWith;

  void _maybeFail() {
    if (failWith != null) throw failWith!;
  }

  @override
  Future<CreatedSale> createManualSale(Map<String, dynamic> body) async {
    _maybeFail();
    created = body;
    return CreatedSale(id: 'nueva', total: 6000);
  }

  @override
  Future<void> editManualSale(String id, Map<String, dynamic> body) async {
    _maybeFail();
    edited = {'id': id, ...body};
  }

  @override
  Future<void> deleteManualSale(String id) async {
    _maybeFail();
    deletedManual = id;
  }

  @override
  Future<void> deleteOrder(String id) async {
    _maybeFail();
    deletedOrder = id;
  }

  @override
  Future<SaleCatalogPage> catalog({String q = '', int limit = 30}) async => _catalog;

  @override
  Future<SaleFormData> formData() async => _formData;

  @override
  Future<ManualSaleEditData> manualSale(String id) async => _editData();
}

// --- Consultas (módulo del grupo Ventas) ---

const _longNote = 'El cliente lo necesita para el cumpleaños de quince de la hija, que es el sábado que viene, '
    'y quiere que lleve el nombre grabado en la base con la misma letra de la invitación. '
    'Mandó tres fotos de referencia y un dibujo a mano; pregunta si se puede hacer en dos colores '
    'y si el precio cambia llevando más de cincuenta para los souvenirs.';
const _longServerError = 'Esta consulta ya está cerrada. Reabrila para cambiar la respuesta, o cargá una nueva '
    'si el cliente volvió a preguntar por otra cantidad o por otro producto.';
final _longMessage = [
  '¡Hola! Gracias por escribirnos. Te paso la cotización:',
  '',
  '📦 PRODUCTO: $_longProduct (x9999)',
  r'💲 Precio (Por unidad): $987.654.321 c/u',
  r'💲 Total (9999 unidades): $9.875.555.555.679',
  r'💲 Precio (A partir de 9999 unidades): $123.456.789 c/u',
  '',
  for (var i = 0; i < 14; i++) '• Detalle número $i de la cotización, con una aclaración bastante larga para el cliente',
  '',
  '⏱ DEMORA ESTIMADA: de 15 a 20 días hábiles desde la seña',
  '',
  'Para confirmar se pide una seña del 50%. ¡Cualquier duda nos escribís!',
].join('\n');

/// Adjuntos que no son fotos, con un nombre larguísimo (el tope del servidor es 120).
List<Map<String, dynamic>> _refFiles(String id, [int n = 3]) => [
      for (final (i, f) in const [
        ('Audio de WhatsApp del cliente explicando cómo quiere el grabado y para qué fecha lo necesita sin falta.ogg', 'audio/ogg'),
        ('diseño.pdf', 'application/pdf'),
        ('video del modelo.mp4', 'video/mp4'),
      ].take(n).indexed)
        {'url': 'https://cdn.test/consultas/$id/files/$i', 'name': f.$1, 'type': f.$2},
    ];

List<String> _refPhotos(String id) => [for (var i = 0; i < 6; i++) 'https://cdn.test/consultas/$id/$i.jpg'];

const _inquiryStatuses = {
  'pending': 'Sin responder',
  'answered': 'Respondida',
  'confirmed': 'Confirmada',
  'cancelled': 'No se hizo',
};

/// Una consulta respondida con todo al límite (precio de 9 cifras, 9999 unidades).
Map<String, dynamic> _extremeAnswered(String id, {String status = 'answered'}) => inquiryJson(
      id,
      customerName: _longName,
      title: _longProduct,
      description: 'Para los souvenirs del cumpleaños.',
      quantity: 9999,
      status: status,
      unitPrice: 987654321,
      unitCost: '456789123.50',
      bulkPrice: '123456789.00',
      bulkFrom: 9999,
      dimensions: 'Base de 12,5 × 8,25 × 5 cm; tapa de 13 × 9 × 1,2 cm; alto total con el grabado 18 cm',
      colors: 'negro mate, blanco perla, dorado metalizado, verde militar, rojo carmesí, azul Francia',
      deliveryTime: 'De 15 a 20 días hábiles desde que se confirma la seña',
      answerNote: _longNote,
      message: _longMessage,
      answeredBy: _longName,
      answeredAt: '2026-11-16T16:30:00.000Z',
    );

/// Cuatro consultas (una por estado). La primera es de quien mira, con textos
/// larguísimos y las seis fotos; la segunda, respondida con números extremos.
ConsultasData _smallConsultas() => ConsultasData.fromJson({
      'items': [
        inquiryJson('c1',
            customerName: _longName,
            title: _longProduct,
            description: '$_longNote $_longNote',
            quantity: 9999,
            mine: true,
            images: _refPhotos('c1'),
            files: _refFiles('c1')),
        _extremeAnswered('c2'),
        // Confirmada: el servidor ya creó el pedido (no se puede reabrir).
        answeredJson('c3', status: 'confirmed', confirmedAt: '2026-11-17T10:00:00.000Z', saleId: 'sale-33'),
        inquiryJson('c4', customerName: 'Pedro', customerPhone: null, title: 'Maceta', description: '', quantity: 1, status: 'cancelled'),
      ],
      'statuses': _inquiryStatuses,
      'maxImages': 6,
      'maxFiles': 8,
      'paymentMethods': {'transfer': 'Transferencia', 'mercadopago': 'MercadoPago', 'cash': 'Efectivo'},
    });

/// Listado largo: 16 consultas en todos los estados.
ConsultasData _bigConsultas() => ConsultasData.fromJson({
      'items': [
        inquiryJson('c1',
            customerName: _longName, title: _longProduct, description: '$_longNote $_longNote', quantity: 9999, mine: true, images: _refPhotos('c1')),
        _extremeAnswered('c2'),
        for (var i = 3; i <= 16; i++)
          i.isEven
              ? answeredJson('c$i',
                  status: const ['answered', 'confirmed', 'cancelled'][i % 3],
                  quantity: i,
                  saleId: i % 3 == 1 ? 'sale-$i' : null,
                  files: i % 4 == 0 ? _refFiles('c$i', 2) : const [])
              : inquiryJson('c$i',
                  title: 'Consulta número $i',
                  quantity: i % 5 == 0 ? 1 : i,
                  status: i % 3 == 0 ? 'cancelled' : 'pending',
                  customerPhone: i % 4 == 1 ? null : '11 5555 00$i',
                  images: i % 4 == 3 ? _refPhotos('c$i').take(3).toList() : const [],
                  mine: i % 4 == 1),
      ],
      'statuses': _inquiryStatuses,
      'maxImages': 6,
    });

// ---------------------------------------------------------------------------
// Arnés del grupo: el panel completo con sus rutas (igual que lib/router.dart)
// ---------------------------------------------------------------------------

/// Pantalla de relleno para las rutas que no son de este grupo.
class _Stub extends StatelessWidget {
  const _Stub(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(child: Text('pantalla: $title')),
      );
}

/// El router del panel, con las mismas rutas y navegadores que el de la app:
/// el contenedor con sus cuatro pestañas y, SOBRE él (navegador raíz), el
/// detalle de la venta y los módulos.
GoRouter _panel(
  WidgetTester tester, {
  String at = '/admin',
  List<Override> shellOverrides = const [],
}) {
  final rootKey = GlobalKey<NavigatorState>(debugLabel: 'raíz');
  final router = GoRouter(
    navigatorKey: rootKey,
    initialLocation: at,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => shellOverrides.isEmpty
            ? AdminShell(shell: shell)
            : ProviderScope(overrides: shellOverrides, child: AdminShell(shell: shell)),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin', builder: (_, _) => const AdminDashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/admin/ventas',
              builder: (_, state) => AdminSalesScreen(
                key: ValueKey(state.uri.toString()),
                initialStatus: state.uri.queryParameters['status'],
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/cola', builder: (_, _) => const AdminProduccionScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/mas', builder: (_, _) => const AdminMoreScreen()),
          ]),
        ],
      ),
      GoRoute(
        path: '/admin/m/filamentos',
        parentNavigatorKey: rootKey,
        builder: (_, _) => const AdminStockScreen(),
      ),
      GoRoute(
        path: '/admin/m/:modulo',
        parentNavigatorKey: rootKey,
        builder: (_, state) => _Stub('Módulo ${state.pathParameters['modulo']}'),
      ),
      GoRoute(
        path: '/admin/venta/:source/:id',
        parentNavigatorKey: rootKey,
        builder: (_, state) => SaleDetailScreen(
          source: state.pathParameters['source']!,
          id: state.pathParameters['id']!,
        ),
      ),
      GoRoute(path: '/cuenta', builder: (_, _) => const _Stub('Cuenta')),
      GoRoute(path: '/ingresar', builder: (_, _) => const _Stub('Ingresar')),
    ],
  );
  addTearDown(router.dispose);
  return router;
}

/// La cola (tercera pestaña): doce trabajos, para que la lista se desplace.
final _board = BoardData.fromJson({
  'items': [
    for (var i = 0; i < 12; i++)
      {
        'id': 'q$i',
        'source': i.isEven ? 'online' : 'manual',
        'label': 'Mate Mario ×$i',
        'customerName': 'Juan Pérez',
        'total': 57500,
        'status': const ['pending_payment', 'confirmed', 'in_production', 'ready'][i % 4],
        'createdAt': '2026-11-10T10:00:00.000Z',
        'ageHours': 5,
        'late': false,
      },
  ],
  'counts': {'late': 0},
});

/// Todo lo que consume el panel, con datos de ejemplo. Cada test pisa lo suyo.
List<Override> _world({
  AdminDashboard? dashboard,
  Future<AdminDashboard> Function()? dashboardLoader,
  SalesPage? sales,
  Future<SalesPage> Function()? salesLoader,
  SaleDetail? sale,
  Future<SaleDetail> Function()? saleLoader,
  _FakeClient? client,
  _FakeVentas? ventas,
  SaleCatalogPage? catalog,
  Future<SaleCatalogPage> Function()? catalogLoader,
  SaleFormData? formData,
  ManualSaleEditData? edit,
  Future<ManualSaleEditData> Function()? editLoader,
  bool withSession = true,
  FakePendientesApi? pendientes,
}) =>
    [
      sessionProvider.overrideWith((ref) => Stream<Session?>.value(withSession ? _session : null)),
      apiClientProvider.overrideWithValue(client ?? _FakeClient()),
      ventasExtraApiProvider.overrideWithValue(ventas ?? _FakeVentas()),
      adminDashboardProvider.overrideWith((ref) => dashboardLoader?.call() ?? Future.value(dashboard ?? _dashboard)),
      adminSalesProvider.overrideWith((ref, f) => salesLoader?.call() ?? Future.value(sales ?? _sales)),
      // Ventas arranca en el mes actual: "hoy" fijo en octubre de 2026.
      ...salesKitOverrides(api: pendientes),
      // El panel mantiene al día la campana: sin avisos, salvo que el test los pise.
      ...notificationsKitOverrides(),
      adminSaleProvider.overrideWith((ref, k) => saleLoader?.call() ?? Future.value(sale ?? _online())),
      adminStockProvider.overrideWith((ref) async => _stock),
      produccionProvider.overrideWith((ref) async => _board),
      saleFormDataProvider.overrideWith((ref) async => formData ?? _formData),
      saleCatalogProvider.overrideWith((ref, q) => catalogLoader?.call() ?? Future.value(catalog ?? _catalog)),
      manualSaleEditProvider.overrideWith((ref, id) => editLoader?.call() ?? Future.value(edit ?? _editData())),
    ];

/// Abre el panel en [at] dentro del teléfono.
Future<void> _openPanel(
  WidgetTester tester, {
  required Phone phone,
  String at = '/admin',
  MeInfo? me,
  bool anonymous = false,
  HefestoThemeMode theme = HefestoThemeMode.dark,
  double textScale = 1,
  List<Override>? world,
  List<Override> shellOverrides = const [],
}) =>
    pumpPhone(
      tester,
      const SizedBox.shrink(),
      phone: phone,
      theme: theme,
      textScale: textScale,
      me: anonymous ? null : (me ?? _admin),
      router: _panel(tester, at: at, shellOverrides: shellOverrides),
      overrides: world ?? _world(),
    );

/// Ventas → toca la primera venta → detalle (el camino real).
Future<void> _openDetail(
  WidgetTester tester, {
  required Phone phone,
  required SaleDetail sale,
  MeInfo? me,
  HefestoThemeMode theme = HefestoThemeMode.dark,
  double textScale = 1,
  _FakeClient? client,
  _FakeVentas? ventas,
  ManualSaleEditData? edit,
  Future<ManualSaleEditData> Function()? editLoader,
  Future<SaleDetail> Function()? saleLoader,
}) async {
  await _openPanel(
    tester,
    phone: phone,
    at: '/admin/ventas',
    me: me,
    theme: theme,
    textScale: textScale,
    world: _world(
      sale: sale,
      saleLoader: saleLoader,
      client: client,
      ventas: ventas,
      edit: edit,
      editLoader: editLoader,
    ),
  );
  // Con letra grande, los filtros de arriba dejan la primera venta al borde:
  // se la trae a la vista como haría quien usa el teléfono.
  await tester.ensureVisible(find.byType(SaleTile).first);
  await settle(tester, 3);
  await tester.tap(find.byType(SaleTile).first);
  await _nav(tester);
  expect(find.text('Detalle'), findsOneWidget, reason: 'tendría que haberse abierto el detalle');
  expectNoLayoutErrors(tester, 'al abrir el detalle');
}

/// Ventas → botón "Nueva venta" → formulario (el camino real).
Future<void> _openNewSale(
  WidgetTester tester, {
  required Phone phone,
  HefestoThemeMode theme = HefestoThemeMode.dark,
  double textScale = 1,
  _FakeVentas? ventas,
  SaleCatalogPage? catalog,
  Future<SaleCatalogPage> Function()? catalogLoader,
  SaleFormData? formData,
}) async {
  await _openPanel(
    tester,
    phone: phone,
    at: '/admin/ventas',
    theme: theme,
    textScale: textScale,
    world: _world(ventas: ventas, catalog: catalog, catalogLoader: catalogLoader, formData: formData),
  );
  await tester.tap(find.byType(FloatingActionButton));
  await _nav(tester);
  expect(find.text('Registrar venta'), findsOneWidget, reason: 'tendría que haberse abierto el formulario');
  expect(find.byType(NavigationBar), findsNothing, reason: 'el formulario se abre sobre la barra del panel');
  expectNoLayoutErrors(tester, 'al abrir Nueva venta');
}

// ---------------------------------------------------------------------------
// Ayudas de verificación
// ---------------------------------------------------------------------------

Finder _field(String label) => find.widgetWithText(TextField, label);

/// El desplazable de una lista (y no el de un campo de texto o una fila de
/// chips, que también son `Scrollable`).
Finder _scrollOf(Finder list) => find.descendant(of: list, matching: find.byType(Scrollable)).first;

/// La lista vertical principal de la pantalla que está arriba.
Finder _mainList() => find.byWidgetPredicate((w) => w is ListView && w.scrollDirection == Axis.vertical).last;

Future<void> _toEnd(WidgetTester tester) => scrollToEnd(tester, scrollable: _scrollOf(_mainList()));

Future<void> _toStart(WidgetTester tester) async {
  final state = tester.state<ScrollableState>(_scrollOf(_mainList()));
  state.position.jumpTo(0);
  await settle(tester, 3);
}

/// Las listas arman sus filas a medida que se acercan a la pantalla: si
/// [finder] todavía no existe, desplaza la lista principal hasta que aparezca
/// y lo deja a la vista.
Future<void> _reveal(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isEmpty) {
    // Por posición y no arrastrando: un arrastre que empieza sobre un campo de
    // varias líneas desplaza el texto del campo, no la lista.
    final position = tester.state<ScrollableState>(_scrollOf(_mainList())).position;
    position.jumpTo(0);
    await tester.pump(const Duration(milliseconds: 50));
    while (finder.evaluate().isEmpty && position.pixels < position.maxScrollExtent - 0.5) {
      position.jumpTo(math.min(position.pixels + 200, position.maxScrollExtent));
      await tester.pump(const Duration(milliseconds: 50));
    }
  }
  expect(finder, findsOneWidget, reason: 'no se encontró: $finder');
  await tester.ensureVisible(finder);
  await tester.pump(const Duration(milliseconds: 50));
}

/// Trae [finder] a la vista dentro de su lista y lo toca.
Future<void> _tap(WidgetTester tester, Finder finder, {int frames = 8}) async {
  await _reveal(tester, finder);
  expect(finder.hitTestable(), findsOneWidget, reason: 'no se puede tocar (¿tapado?): $finder');
  await tester.tap(finder);
  await settle(tester, frames);
}

/// Deja terminar un cambio de pantalla (en iPhone la transición dura 500 ms).
Future<void> _nav(WidgetTester tester) => settle(tester, 9);

/// Abre el teclado en un campo de la pantalla (lo busca en la lista si hace falta).
Future<void> _kbd(WidgetTester tester, Finder field) async {
  await _reveal(tester, field);
  await openKeyboard(tester, field);
}

/// Escribe en un campo y deja que la pantalla se acomode (el campo se trae a
/// la vista con una animación corta).
Future<void> _type(WidgetTester tester, Finder field, String text) async {
  await tester.enterText(field, text);
  await settle(tester, 3);
}

/// [what] tiene que terminar ARRIBA de [barrier] (la barra de pestañas, el
/// botón flotante, el pie del formulario…): nada puede quedar tapado.
void _expectAbove(WidgetTester tester, Finder what, Finder barrier, {required String reason}) {
  expect(what, findsOneWidget, reason: 'no se encontró: $reason');
  final a = tester.getRect(what);
  final b = tester.getRect(barrier.first);
  expect(a.bottom <= b.top + 0.5, isTrue, reason: '$reason: termina en ${a.bottom.toStringAsFixed(0)} y la barrera empieza en ${b.top.toStringAsFixed(0)}');
}

/// El texto entra entero en su renglón: ni cortado con "…" ni partido en dos.
void _expectOneLine(WidgetTester tester, Finder text, {required String what}) {
  expect(text, findsOneWidget, reason: 'no se encontró $what');
  final p = tester.renderObject<RenderParagraph>(text);
  expect(p.didExceedMaxLines, isFalse, reason: '$what se corta');
  final needed = p.getMaxIntrinsicWidth(double.infinity);
  expect(p.size.width + 0.5 >= needed, isTrue, reason: '$what no entra en una línea (${p.size.width} de $needed)');
}

/// La hoja inferior abierta no se mete debajo de la barra de estado / notch.
void _expectSheetBelowStatusBar(WidgetTester tester) {
  final sheet = find.byType(BottomSheet);
  expect(sheet, findsOneWidget, reason: 'tendría que haber una hoja abierta');
  expect(
    tester.getRect(sheet).top >= currentPhone.top - 0.5,
    isTrue,
    reason: 'la hoja se mete debajo de la barra de estado en ${currentPhone.name}',
  );
}

Finder _inNavBar(String label) => find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

Finder _inSheet(Finder f) => find.descendant(of: find.byType(BottomSheet), matching: f);

Finder _inDialog(Finder f) => find.descendant(of: find.byType(Dialog), matching: f);

final _launched = <String>[];

void main() {
  setUpAll(() async {
    await setUpDeviceKit();
    mockImageCachePlugins();
    // WhatsApp / llamar / comprobante abren otra app: acá solo se anota.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/url_launcher'),
      (call) async {
        if (call.method == 'launch') _launched.add('${(call.arguments as Map)['url']}');
        return true;
      },
    );
  });

  setUp(_launched.clear);

  // =========================================================================
  group('Contenedor del panel', () {
    for (final phone in Phone.both) {
      for (final scale in [1.0, 1.3]) {
        final tag = scale == 1.0 ? '' : '_grande';
        testWidgets('las cuatro pestañas en ${phone.name} (letra ${scale}x): rótulos enteros y nada tapado', (tester) async {
          await _openPanel(tester, phone: phone, textScale: scale);
          final bar = find.byType(NavigationBar);
          expect(bar, findsOneWidget);
          for (final label in ['Inicio', 'Ventas', 'Cola', 'Más']) {
            _expectOneLine(tester, _inNavBar(label), what: 'el rótulo "$label" de la barra');
            expectReachable(tester, _inNavBar(label), what: 'el rótulo "$label" de la barra');
          }
          // El globito de "pendientes de pago" sobre Ventas.
          expect(find.descendant(of: bar, matching: find.text('3')), findsOneWidget);

          // Inicio: lo último queda arriba de la barra.
          await _toEnd(tester);
          _expectAbove(tester, find.byType(FilamentTile).last, bar, reason: 'el último filamento del inicio');
          await shoot(tester, 'shell_inicio_fin$tag');

          // Ventas: la última venta no queda debajo del botón ni de la barra.
          await tester.tap(_inNavBar('Ventas'));
          await settle(tester);
          expectNoLayoutErrors(tester, 'en la pestaña Ventas');
          expect(find.text('4 ventas'), findsOneWidget);
          await _toEnd(tester);
          _expectAbove(tester, find.byType(SaleTile).last, find.byType(FloatingActionButton), reason: 'la última venta');
          _expectAbove(tester, find.byType(FloatingActionButton), bar, reason: 'el botón Nueva venta');
          await shoot(tester, 'shell_ventas$tag');

          // Cola (pantalla de otro grupo): solo que no quede tapada.
          await tester.tap(_inNavBar('Cola'));
          await settle(tester);
          expectNoLayoutErrors(tester, 'en la pestaña Cola');
          expect(find.descendant(of: find.byType(AppBar), matching: find.text('Cola')), findsOneWidget);
          await _toEnd(tester);
          _expectAbove(tester, find.byType(AdminCard).last, bar, reason: 'el último trabajo de la cola');
          await shoot(tester, 'shell_cola$tag');

          // Más.
          await tester.tap(_inNavBar('Más'));
          await settle(tester);
          expectNoLayoutErrors(tester, 'en la pestaña Más');
          await _toEnd(tester);
          _expectAbove(tester, find.text('Volver a la tienda'), bar, reason: '"Volver a la tienda"');
          await shoot(tester, 'shell_mas_fin$tag');
        });
      }

      testWidgets('sin sesión, cuenta sin acceso, cargando y error en ${phone.name}', (tester) async {
        // Sin sesión.
        await _openPanel(tester, phone: phone, anonymous: true, world: _world(withSession: false));
        expect(find.text('Ingresá para ver el panel'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Ingresar'), what: 'el botón Ingresar');
        expect(find.byType(NavigationBar), findsNothing);
        await shoot(tester, 'shell_sin_sesion');
        await tester.tap(find.widgetWithText(GoldButton, 'Ingresar'));
        await settle(tester);
        expect(find.text('pantalla: Ingresar'), findsOneWidget);

        // Con sesión pero la cuenta no es del equipo.
        final customer = MeInfo.fromJson({'id': 'c1', 'role': 'customer', 'isStaff': false, 'fullName': 'Cliente'});
        await _openPanel(tester, phone: phone, me: customer);
        expect(find.text('Esta cuenta no tiene acceso al panel'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Volver a la tienda'), what: 'el botón de volver');
        await shoot(tester, 'shell_sin_acceso');
        await tester.tap(find.widgetWithText(GoldButton, 'Volver a la tienda'));
        await settle(tester);
        expect(find.text('pantalla: Cuenta'), findsOneWidget);

        // El perfil todavía no llegó.
        await _openPanel(
          tester,
          phone: phone,
          shellOverrides: [meProvider.overrideWith((ref) => Completer<MeInfo?>().future)],
        );
        expect(find.byType(LoadingView), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);

        // El perfil falló: mensaje y Reintentar a mano.
        await _openPanel(
          tester,
          phone: phone,
          shellOverrides: [
            meProvider.overrideWith(
              (ref) => Future<MeInfo?>.error(ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')),
            ),
          ],
        );
        expect(find.textContaining('No pudimos conectarnos'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar');
        await shoot(tester, 'shell_error');
      });

      testWidgets('"atrás" del sistema en ${phone.name}: de Ventas al Inicio y del Inicio a la cuenta', (tester) async {
        await _openPanel(tester, phone: phone);
        await tester.tap(_inNavBar('Ventas'));
        await settle(tester);
        expect(find.text('4 ventas'), findsOneWidget);
        await tester.binding.handlePopRoute();
        await settle(tester);
        expect(find.text('Hola, Ale'), findsOneWidget, reason: 'atrás desde Ventas vuelve al Inicio');
        await tester.binding.handlePopRoute();
        await settle(tester);
        expect(find.text('pantalla: Cuenta'), findsOneWidget, reason: 'atrás desde el Inicio sale a la cuenta');
      });
    }

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('barra del panel en tema ${mode.name}', (tester) async {
        await _openPanel(tester, phone: Phone.small, theme: mode);
        await shoot(tester, 'shell_inicio_${mode.name}');
        await tester.tap(_inNavBar('Más'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'shell_mas_${mode.name}');
      });
    }
  });

  // =========================================================================
  group('Inicio', () {
    for (final phone in Phone.both) {
      testWidgets('con datos en ${phone.name}: atajos, resumen, últimos pedidos y stock', (tester) async {
        await _openPanel(tester, phone: phone);
        expect(find.text('Hola, Ale'), findsOneWidget);
        await shoot(tester, 'inicio');
        await _reveal(tester, find.text('Por cobrar'));
        await _toStart(tester);
        await tester.drag(_mainList(), const Offset(0, -360));
        await settle(tester, 3);
        await shoot(tester, 'inicio_2');
        await _toEnd(tester);
        expectReachable(tester, find.text('Filamentos por reponer'.toUpperCase()), what: 'el título de filamentos');
        await shoot(tester, 'inicio_fin');
      });

      testWidgets('datos extremos en ${phone.name}: 9 cifras, nombres largos y aviso de datos parciales', (tester) async {
        await _openPanel(tester, phone: phone, world: _world(dashboard: _dashboardExtreme));
        expect(find.textContaining('No pudimos cargar los KPIs'), findsOneWidget);
        expect(find.text(r'$987.654.321'), findsWidgets);
        await shoot(tester, 'inicio_extremo');
        await tester.drag(_mainList(), const Offset(0, -420));
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'inicio_extremo_2');
        await tester.drag(_mainList(), const Offset(0, -420));
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'inicio_extremo_3');
        await _toEnd(tester);
        await shoot(tester, 'inicio_extremo_fin');
      });

      testWidgets('vacío, cargando y error en ${phone.name}', (tester) async {
        await _openPanel(tester, phone: phone, world: _world(dashboard: _dashboardEmpty));
        expect(find.text('Hola'), findsNothing, reason: 'sin nombre del servidor usa el del perfil');
        expect(find.text('Hola, Ale'), findsOneWidget);
        await _toEnd(tester);
        expect(find.text('Todavía no hay pedidos online.'), findsOneWidget);
        _expectAbove(tester, find.text('Todavía no hay pedidos online.'), find.byType(NavigationBar), reason: 'el aviso de sin pedidos');
        await shoot(tester, 'inicio_vacio');

        await _openPanel(tester, phone: phone, world: _world(dashboardLoader: () => Completer<AdminDashboard>().future));
        expect(find.byType(Skeleton), findsWidgets);
        await shoot(tester, 'inicio_cargando');

        await _openPanel(
          tester,
          phone: phone,
          world: _world(
            dashboardLoader: () => Future.error(
              ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.'),
            ),
          ),
        );
        expect(find.textContaining('No pudimos completar la operación'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar');
        await shoot(tester, 'inicio_error');
      });

      testWidgets('los atajos llevan a donde dicen en ${phone.name}', (tester) async {
        // Un pedido listo de AGOSTO (el "hoy" de la prueba es fin de octubre).
        final withOld = SalesPage.fromJson({
          'total': 5,
          'items': [
            ..._salesJson,
            {..._row('r', status: 'ready', ref: 'HF-0007'), 'date': '2026-08-05T15:00:00.000Z'},
          ],
        });
        await _openPanel(tester, phone: phone, world: _world(sales: withOld));
        // "Listos" → Ventas filtradas, con el filtro elegido A LA VISTA y en
        // TODOS los meses (el número del inicio no es solo de este mes).
        await _tap(tester, find.text('Listos'));
        expect(find.text('1 venta'), findsOneWidget);
        expect(find.text('HF-0007'), findsOneWidget);
        expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Todos los meses')).selected, isTrue);
        final chip = find.widgetWithText(ChoiceChip, 'Listo para entregar (1)');
        expect(tester.widget<ChoiceChip>(chip).selected, isTrue);
        expectReachable(tester, chip, what: 'el filtro elegido ("Listo para entregar")');
        await shoot(tester, 'inicio_atajo_listos');

        // "En producción" cuenta los confirmados + los que se están imprimiendo:
        // abre la cola (donde están los dos), no una lista con menos pedidos.
        await tester.tap(_inNavBar('Inicio'));
        await _nav(tester);
        await _tap(tester, find.descendant(of: find.byType(FittedBox), matching: find.text('En producción')));
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Cola')), findsOneWidget);
        expect(find.byType(NavigationBar), findsOneWidget, reason: 'la cola es una pestaña del panel');

        // Volver al inicio y abrir un pedido de "Últimos pedidos".
        await tester.tap(_inNavBar('Inicio'));
        await _nav(tester);
        await _tap(tester, find.text('HF-0042'));
        expect(find.text('Detalle'), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing, reason: 'el detalle se abre sobre la barra del panel');
        await tester.tap(find.byTooltip('Atrás'));
        await _nav(tester);
        expect(find.text('Detalle'), findsNothing);
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Inicio')), findsOneWidget);

        // "Ver stock" → módulo Filamentos, sobre la barra del panel, y vuelve.
        await _tap(tester, find.text('Ver stock'));
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Filamentos')), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing, reason: 'el stock se abre sobre la barra del panel');
        await tester.tap(find.byTooltip('Atrás'));
        await _nav(tester);
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Inicio')), findsOneWidget);
      });
    }

    testWidgets('sin permiso de pedidos ni de filamentos: los números se ven pero no llevan a ningún lado', (tester) async {
      await _openPanel(tester, phone: Phone.small, me: staffWith(const ['clientes'], role: 'operator'));
      expect(find.text('Últimos pedidos'.toUpperCase()), findsNothing);
      expect(find.text('Filamentos por reponer'.toUpperCase()), findsNothing);
      await _reveal(tester, find.text('Por cobrar'));
      await tester.tap(find.text('Por cobrar'));
      await _nav(tester);
      expect(find.descendant(of: find.byType(AppBar), matching: find.text('Inicio')), findsOneWidget,
          reason: 'sin permiso el atajo no navega');
      await _toEnd(tester);
      await shoot(tester, 'inicio_sin_permisos');
    });

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      await _openPanel(tester, phone: Phone.small, textScale: 1.3);
      await shoot(tester, 'inicio_grande');
      await tester.drag(_mainList(), const Offset(0, -400));
      await settle(tester, 3);
      expectNoLayoutErrors(tester);
      await shoot(tester, 'inicio_grande_2');
      await tester.drag(_mainList(), const Offset(0, -400));
      await settle(tester, 3);
      expectNoLayoutErrors(tester);
      await shoot(tester, 'inicio_grande_3');
      await _toEnd(tester);
      await shoot(tester, 'inicio_grande_fin');

      await _openPanel(tester, phone: Phone.small, textScale: 1.3, world: _world(dashboard: _dashboardExtreme));
      await shoot(tester, 'inicio_extremo_grande');
      for (var i = 0; i < 4; i++) {
        await tester.drag(_mainList(), const Offset(0, -420));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'inicio extremo con letra grande, tramo $i');
        await shoot(tester, 'inicio_extremo_grande_$i');
      }
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}', (tester) async {
        await _openPanel(tester, phone: Phone.iphone, theme: mode);
        await shoot(tester, 'inicio_${mode.name}');
        await _toEnd(tester);
        await shoot(tester, 'inicio_fin_${mode.name}');
      });
    }
  });

  // =========================================================================
  group('Ventas', () {
    for (final phone in Phone.both) {
      testWidgets('listado en ${phone.name}: filtros, buscador con teclado y botón', (tester) async {
        await _openPanel(tester, phone: phone, at: '/admin/ventas');
        expect(find.text('4 ventas'), findsOneWidget);
        expectReachable(tester, find.byType(FloatingActionButton), what: 'el botón Nueva venta');
        await shoot(tester, 'ventas');

        // Arriba de todo, la entrada a los pendientes del equipo (sin tapar la lista).
        expectReachable(tester, find.text('Pendientes del equipo · 3'), what: 'la entrada a los pendientes');
        expect(find.byType(SaleTile), findsWidgets, reason: 'las ventas se ven sin desplazar');
        // Arranca en el mes actual.
        expect(tester.widget<ChoiceChip>(find.byKey(const ValueKey('ventas-mes'))).selected, isTrue);
        expect(find.widgetWithText(ChoiceChip, 'Octubre 2026'), findsOneWidget);

        // Filtros: se pueden tocar y quedan marcados.
        await tester.tap(find.widgetWithText(ChoiceChip, 'Mostrador'));
        await settle(tester);
        expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Mostrador')).selected, isTrue);
        await tester.tap(find.widgetWithText(ChoiceChip, 'Pendiente de pago (1)'));
        await settle(tester);
        expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Pendiente de pago (1)')).selected, isTrue);
        expect(find.text('1 venta'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'ventas_filtros');
        await tester.tap(find.widgetWithText(ChoiceChip, 'Todos (4)'));
        await settle(tester);

        // Buscador con el teclado abierto.
        await _kbd(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        await _type(tester, find.byType(TextField), 'llaveros personalizados');
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al buscar');
        expectReachable(tester, find.byIcon(Icons.close_rounded), what: 'la cruz de limpiar la búsqueda');
        await shoot(tester, 'ventas_teclado');
        await tester.tap(find.byIcon(Icons.close_rounded));
        await closeKeyboard(tester);
      });

      testWidgets('40 ventas largas en ${phone.name}: la última no queda debajo del botón', (tester) async {
        await _openPanel(tester, phone: phone, at: '/admin/ventas', world: _world(sales: _salesMany));
        expect(find.text('40 ventas'), findsOneWidget);
        // Hay más en el servidor de las que llegan: se avisa.
        expect(find.textContaining('Hay 350 ventas y se cargaron las 40 más nuevas'), findsOneWidget);
        await shoot(tester, 'ventas_muchas');
        await _toEnd(tester);
        _expectAbove(tester, find.byType(SaleTile).last, find.byType(FloatingActionButton), reason: 'la última venta');
        await shoot(tester, 'ventas_muchas_fin');
      });

      testWidgets('vacío, error, cargando y sin permiso en ${phone.name}', (tester) async {
        final empty = SalesPage.fromJson({'total': 0, 'items': <dynamic>[]});
        await _openPanel(tester, phone: phone, at: '/admin/ventas', world: _world(sales: empty));
        expect(find.text('No hay ventas en octubre 2026'), findsOneWidget);
        expect(find.text('Mirá otro mes con las flechas, o tocá "Todos los meses".'), findsOneWidget);
        await shoot(tester, 'ventas_vacio');
        await _tap(tester, find.widgetWithText(ChoiceChip, 'Todos los meses'));
        expect(find.text('No hay ventas para mostrar'), findsOneWidget);
        expect(find.text('Cuando entre un pedido o cargues una venta, aparece acá.'), findsOneWidget);
        await shoot(tester, 'ventas_vacio_todos');
        // Con un filtro puesto el texto cambia.
        await _tap(tester, find.widgetWithText(ChoiceChip, 'Tienda'));
        expect(find.text('Probá quitando algún filtro o cambiando la búsqueda.'), findsOneWidget);
        // Con el teclado abierto el aviso se desplaza, no se desborda.
        await _kbd(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'ventas_vacio_teclado');
        await closeKeyboard(tester);

        await _openPanel(
          tester,
          phone: phone,
          at: '/admin/ventas',
          world: _world(salesLoader: () => Future.error(ApiException('invalid', 'Filtros inválidos.'))),
        );
        expect(find.text('Filtros inválidos.'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar');
        await shoot(tester, 'ventas_error');

        await _openPanel(tester, phone: phone, at: '/admin/ventas', world: _world(salesLoader: () => Completer<SalesPage>().future));
        expect(find.byType(Skeleton), findsWidgets);

        await _openPanel(tester, phone: phone, at: '/admin/ventas', me: staffWith(const ['clientes'], role: 'operator'));
        expect(find.text('Sin acceso'), findsOneWidget);
        expect(find.byType(FloatingActionButton), findsNothing);
        await shoot(tester, 'ventas_sin_acceso');
      });
    }

    for (final phone in Phone.both) {
      testWidgets('meses en ${phone.name}: mes actual, flechas, atrasadas y todos los meses', (tester) async {
        await _openPanel(tester, phone: phone, at: '/admin/ventas', world: _world(sales: _salesMonths));
        // Octubre: las cuatro de siempre + la del 31 a las 22:30 (hora argentina).
        expect(find.text('5 ventas'), findsOneWidget);
        expect(find.widgetWithText(ChoiceChip, 'Todos (5)'), findsOneWidget);
        expect(find.widgetWithText(ChoiceChip, 'Sin cerrar (3)'), findsOneWidget);
        expect(find.widgetWithText(ChoiceChip, 'Pago confirmado (1)'), findsOneWidget);
        // Lo que quedó abierto de antes se avisa, con su "Ver" a mano.
        final notice = find.text('Hay 2 pedidos de meses anteriores sin cerrar');
        expectReachable(tester, notice, what: 'el aviso de pedidos atrasados');
        final see = find.widgetWithText(TextButton, 'Ver');
        expectReachable(tester, see, what: 'el botón Ver del aviso');
        _expectOneLine(tester, find.text('Octubre 2026'), what: 'el mes');
        await shoot(tester, 'ventas_mes_actual');

        // Mes anterior: septiembre, con su propio conteo y el camino de vuelta.
        await tester.tap(find.byTooltip('Mes anterior'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(find.widgetWithText(ChoiceChip, 'Septiembre 2026'), findsOneWidget);
        expect(find.text('2 ventas'), findsOneWidget);
        expect(find.text('Hay 1 pedido de meses anteriores sin cerrar'), findsOneWidget);
        await shoot(tester, 'ventas_mes_anterior');
        // La fila del mes se desplaza hasta "Volver a octubre 2026".
        final back = find.widgetWithText(TextButton, 'Volver a octubre 2026');
        await tester.ensureVisible(back);
        await settle(tester, 3);
        expectReachable(tester, back, what: 'Volver a octubre 2026');
        await shoot(tester, 'ventas_mes_volver');
        await tester.tap(back);
        await settle(tester);
        expect(find.text('5 ventas'), findsOneWidget);

        // Mes siguiente: noviembre vacío (la del 31 a la noche NO cae acá).
        await tester.ensureVisible(find.byTooltip('Mes siguiente'));
        await tester.tap(find.byTooltip('Mes siguiente'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(find.text('No hay ventas en noviembre 2026'), findsOneWidget);
        await shoot(tester, 'ventas_mes_vacio');
        await tester.tap(find.byKey(const ValueKey('ventas-mes')));
        await settle(tester);
        expect(find.widgetWithText(ChoiceChip, 'Octubre 2026'), findsOneWidget);

        // "Ver": todos los meses + lo que sigue sin cerrar.
        await tester.tap(see);
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Todos los meses')).selected, isTrue);
        expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Sin cerrar (5)')).selected, isTrue);
        expect(find.text('5 ventas'), findsOneWidget);
        expect(find.textContaining('meses anteriores sin cerrar'), findsNothing);
        await shoot(tester, 'ventas_atrasadas');
        await _toEnd(tester);
        _expectAbove(tester, find.byType(SaleTile).last, find.byType(FloatingActionButton), reason: 'la última venta atrasada');
      });
    }

    testWidgets('sin permiso de crear no hay botón y la lista usa todo el alto', (tester) async {
      await _openPanel(tester, phone: Phone.small, at: '/admin/ventas', me: _operator, world: _world(sales: _salesMany));
      expect(find.byType(FloatingActionButton), findsNothing);
      await _toEnd(tester);
      _expectAbove(tester, find.byType(SaleTile).last, find.byType(NavigationBar), reason: 'la última venta');
    });

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      // Con el aviso de atrasadas y los contadores, con letra grande.
      await _openPanel(tester, phone: Phone.small, at: '/admin/ventas', textScale: 1.3, world: _world(sales: _salesMonths));
      expectReachable(tester, find.text('Pendientes del equipo · 3'), what: 'la entrada a los pendientes con letra grande');
      await _reveal(tester, find.text('Hay 2 pedidos de meses anteriores sin cerrar'));
      expectReachable(tester, find.widgetWithText(TextButton, 'Ver'), what: 'Ver con letra grande');
      await shoot(tester, 'ventas_mes_grande');
      await tester.tap(find.byTooltip('Mes anterior'));
      await settle(tester);
      expectNoLayoutErrors(tester);
      await shoot(tester, 'ventas_mes_anterior_grande');

      await _openPanel(tester, phone: Phone.small, at: '/admin/ventas', textScale: 1.3, world: _world(sales: _salesMany));
      await shoot(tester, 'ventas_grande');
      await _toEnd(tester);
      _expectAbove(tester, find.byType(SaleTile).last, find.byType(FloatingActionButton), reason: 'la última venta');
      await shoot(tester, 'ventas_grande_fin');
      await _kbd(tester, find.byType(TextField));
      expectFocusedFieldVisible(tester);
      await shoot(tester, 'ventas_grande_teclado');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}', (tester) async {
        await _openPanel(tester, phone: Phone.small, at: '/admin/ventas', theme: mode);
        await tester.tap(find.widgetWithText(ChoiceChip, 'Mostrador'));
        await settle(tester);
        await shoot(tester, 'ventas_${mode.name}');
      });
    }
  });

  // =========================================================================
  group('Detalle de la venta', () {
    for (final phone in Phone.both) {
      testWidgets('pedido online listo para entregar en ${phone.name}: todo se ve y se llega al final', (tester) async {
        await _openDetail(tester, phone: phone, sale: _online());
        expect(find.byType(NavigationBar), findsNothing);
        expect(find.text('HF-0042'), findsWidgets);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Marcar enviado'), what: 'la acción principal');
        await shoot(tester, 'detalle');
        await tester.drag(_mainList(), const Offset(0, -400));
        await settle(tester, 3);
        await shoot(tester, 'detalle_2');
        await tester.drag(_mainList(), const Offset(0, -400));
        await settle(tester, 3);
        await shoot(tester, 'detalle_3');
        await _toEnd(tester);
        expectReachable(tester, find.text('Pedido creado · Pendiente de pago'), what: 'el último renglón del historial');
        await shoot(tester, 'detalle_fin');
      });

      // Cada cambio de estado, abierto con su botón real.
      final actions = <(String, String, String, String)>[
        // (estado del pedido, botón, botón de la hoja, estado que pide)
        ('pending_payment', 'Confirmar pago', 'Confirmar', 'confirmed'),
        ('confirmed', 'Pasar a producción', 'Confirmar', 'in_production'),
        ('in_production', 'Marcar listo', 'Confirmar', 'ready'),
        ('ready', 'Marcar entregado', 'Confirmar', 'delivered'),
        ('ready', 'Cancelar', 'Sí, cancelar', 'cancelled'),
        ('delivered', 'Reembolsar', 'Sí, reembolsar', 'refunded'),
      ];
      for (final (from, button, confirm, to) in actions) {
        testWidgets('acción "$button" en ${phone.name}: hoja completa, con teclado, y se confirma', (tester) async {
          final client = _FakeClient();
          await _openDetail(tester, phone: phone, sale: _online(status: from, tracking: 'AB123'), client: client);
          await _tap(tester, find.text(button));
          expectNoLayoutErrors(tester, 'al abrir "$button"');
          _expectSheetBelowStatusBar(tester);
          final main = _inSheet(find.text(confirm));
          final close = _inSheet(find.text('Volver'));
          expectReachable(tester, main, what: 'el botón "$confirm"');
          expectReachable(tester, close, what: 'el botón "Volver"');
          expect(_inSheet(find.text(button)), findsOneWidget, reason: 'la hoja lleva de título la acción');
          await shoot(tester, 'accion_${to}_hoja');

          // Nota / motivo con el teclado abierto.
          final note = _inSheet(find.byType(TextField)).last;
          await _kbd(tester, note);
          expectFocusedFieldVisible(tester);
          _expectSheetBelowStatusBar(tester);
          expectReachable(tester, main, what: 'el botón "$confirm" con el teclado abierto');
          expectReachable(tester, close, what: 'el botón "Volver" con el teclado abierto');
          await _type(tester, note, 'Avisado por WhatsApp');
          await settle(tester, 2);
          await shoot(tester, 'accion_${to}_teclado');

          await tester.tap(main);
          await settle(tester);
          expect(client.calls, ['estado online/o1 → $to (Avisado por WhatsApp)']);
          expect(find.byType(BottomSheet), findsNothing, reason: 'la hoja se cierra al terminar');
          expect(find.textContaining('HF-0042: '), findsOneWidget, reason: 'avisa que se hizo el cambio');
          await closeKeyboard(tester);
        });
      }

      testWidgets('"Marcar enviado" sin código en ${phone.name}: lo pide, valida y guarda las dos cosas', (tester) async {
        final client = _FakeClient();
        await _openDetail(tester, phone: phone, sale: _online(), client: client);
        await _tap(tester, find.widgetWithText(GoldButton, 'Marcar enviado'));
        _expectSheetBelowStatusBar(tester);
        final main = _inSheet(find.text('Confirmar'));
        final tracking = _inSheet(_field('Código de seguimiento'));
        expect(tracking, findsOneWidget);
        expectReachable(tester, main, what: 'el botón Confirmar');
        await shoot(tester, 'accion_enviado_hoja');

        // Sin código no avanza y explica por qué, con el botón todavía a mano.
        await tester.tap(main);
        await settle(tester, 3);
        expectReachable(
          tester,
          find.text('Cargá el código de seguimiento para marcarlo como enviado.'),
          what: 'el aviso de que falta el código',
        );
        expect(client.calls, isEmpty);
        expectReachable(tester, main, what: 'el botón Confirmar con el aviso de error');
        await shoot(tester, 'accion_enviado_falta_codigo');

        // Primer campo con teclado.
        await _kbd(tester, tracking);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, main, what: 'el botón Confirmar con el teclado abierto');
        await _type(tester, tracking, 'OCA-123456789');
        await settle(tester, 2);
        await shoot(tester, 'accion_enviado_teclado');
        // Último campo (nota) con teclado.
        await tester.tap(_inSheet(find.byType(TextField)).last, warnIfMissed: false);
        await settle(tester, 4);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, main, what: 'el botón Confirmar con el teclado en la nota');
        await shoot(tester, 'accion_enviado_teclado_nota');

        await tester.tap(main);
        await settle(tester);
        expect(client.calls, ['meta o1 tracking=OCA-123456789 nota=∅', 'estado online/o1 → shipped']);
        expect(find.byType(BottomSheet), findsNothing);
        await closeKeyboard(tester);
      });

      testWidgets('cancelar en ${phone.name}: motivos rápidos, error del servidor a la vista y reintento', (tester) async {
        final client = _FakeClient()
          ..failStatus = ApiException('invalid', 'El pedido cambió de estado mientras se procesaba. Recargá e intentá de nuevo.', status: 422);
        await _openDetail(tester, phone: phone, sale: _online(), client: client);
        await _tap(tester, find.text('Cancelar'));
        final main = _inSheet(find.text('Sí, cancelar'));
        for (final r in cancelReasons) {
          expect(_inSheet(find.text(r)), findsOneWidget, reason: 'falta el motivo "$r"');
        }
        await shoot(tester, 'accion_cancelar_motivos');
        // Un motivo rápido completa el campo.
        await _tap(tester, _inSheet(find.text(cancelReasons[1])), frames: 3);
        expect(find.widgetWithText(TextField, cancelReasons[1]), findsOneWidget);

        await tester.ensureVisible(main);
        await tester.tap(main);
        await settle(tester);
        expectReachable(tester, find.textContaining('El pedido cambió de estado'), what: 'el error del servidor');
        expect(find.byType(BottomSheet), findsOneWidget, reason: 'la hoja sigue abierta para reintentar');
        expectReachable(tester, main, what: 'el botón "Sí, cancelar" con el error visible');
        expectReachable(tester, _inSheet(find.text('Volver')), what: 'el botón Volver con el error visible');
        await shoot(tester, 'accion_cancelar_error');

        // Con el teclado y el error a la vez, el botón sigue a mano.
        await _kbd(tester, _inSheet(find.byType(TextField)).last);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, main, what: 'el botón "Sí, cancelar" con teclado y error');
        expectReachable(tester, find.textContaining('El pedido cambió de estado'), what: 'el error del servidor con el teclado abierto');
        await shoot(tester, 'accion_cancelar_error_teclado');

        client.failStatus = null;
        await tester.tap(main);
        await settle(tester);
        expect(client.calls, ['estado online/o1 → cancelled (${cancelReasons[1]})']);
        expect(find.byType(BottomSheet), findsNothing);
        await closeKeyboard(tester);
      });

      testWidgets('"Volver" cierra la hoja sin cambiar nada en ${phone.name}', (tester) async {
        final client = _FakeClient();
        await _openDetail(tester, phone: phone, sale: _online(), client: client);
        await _tap(tester, find.text('Reembolsar'));
        expect(_inSheet(find.text('Sí, reembolsar')), findsOneWidget);
        await tester.tap(_inSheet(find.text('Volver')));
        await settle(tester);
        expect(find.byType(BottomSheet), findsNothing);
        expect(client.calls, isEmpty);
      });

      testWidgets('envío y notas en ${phone.name}: los dos campos con teclado y Guardar', (tester) async {
        final client = _FakeClient();
        await _openDetail(tester, phone: phone, sale: _online(note: null), client: client);
        final tracking = _field('Código de seguimiento');
        final note = _field('Nota interna (el cliente no la ve)');
        final save = find.widgetWithText(GoldButton, 'Guardar');

        await _kbd(tester, tracking);
        expectFocusedFieldVisible(tester);
        await _type(tester, tracking, 'OCA-123');
        await settle(tester, 2);
        await shoot(tester, 'detalle_meta_teclado');

        await _kbd(tester, note);
        expectFocusedFieldVisible(tester);
        await _type(tester, note, 'Llamar antes de enviar. ' * 6);
        await settle(tester, 2);
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'detalle_meta_nota_teclado');

        // Con el teclado abierto se llega a Guardar desplazando.
        await tester.ensureVisible(save);
        await settle(tester, 3);
        expectReachable(tester, save, what: 'el botón Guardar con el teclado abierto');
        await tester.tap(save);
        await settle(tester);
        expect(client.calls.single, startsWith('meta o1 tracking=OCA-123 nota=Llamar antes de enviar.'));
        expect(find.text('Guardado'), findsOneWidget);
        await closeKeyboard(tester);
      });

      testWidgets('menú ⋮ y eliminar en ${phone.name}: confirmación, error en el diálogo y borrado', (tester) async {
        final ventas = _FakeVentas()..failWith = ApiException('forbidden', 'Eliminar pedidos es solo para administradores.', status: 403);
        await _openDetail(tester, phone: phone, sale: _online(), ventas: ventas);
        await tester.tap(find.byTooltip('Más acciones'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al abrir el menú');
        expect(find.text('Editar venta'), findsNothing, reason: 'un pedido online no se edita');
        expectReachable(tester, find.text('Ver comprobante'), what: '"Ver comprobante"');
        expectReachable(tester, find.text('Eliminar pedido'), what: '"Eliminar pedido"');
        await shoot(tester, 'detalle_menu');

        await tester.tap(find.text('Eliminar pedido'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al abrir el diálogo de eliminar');
        expect(find.text('¿Eliminar el pedido HF-0042?'), findsOneWidget);
        final delete = _inDialog(find.widgetWithText(FilledButton, 'Eliminar'));
        final cancel = _inDialog(find.widgetWithText(TextButton, 'Cancelar'));
        expectReachable(tester, delete, what: 'el botón Eliminar');
        expectReachable(tester, cancel, what: 'el botón Cancelar');
        await shoot(tester, 'detalle_eliminar');

        await tester.tap(delete);
        await settle(tester);
        expect(find.text('Eliminar pedidos es solo para administradores.'), findsOneWidget);
        expectReachable(tester, delete, what: 'el botón Eliminar con el error visible');
        expectReachable(tester, cancel, what: 'el botón Cancelar con el error visible');
        await shoot(tester, 'detalle_eliminar_error');

        ventas.failWith = null;
        await tester.tap(delete);
        await settle(tester);
        expect(ventas.deletedOrder, 'o1');
        expect(find.text('Detalle'), findsNothing, reason: 'vuelve al listado');
        expect(find.text('Pedido HF-0042 eliminado'), findsOneWidget);
        await shoot(tester, 'detalle_eliminado_aviso');
      });

      testWidgets('venta de mostrador en ${phone.name}: acciones, menú con Editar y comprobante', (tester) async {
        await _openDetail(tester, phone: phone, sale: _manual(status: 'pending_payment'));
        expect(find.text('Venta manual'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar pago'), what: 'Confirmar pago');
        expect(_field('Código de seguimiento'), findsNothing, reason: 'una venta de mostrador no tiene envío');
        await shoot(tester, 'detalle_manual');
        await _toEnd(tester);
        expectReachable(tester, find.text('Llaveros'), what: 'la categoría (lo último)');
        await shoot(tester, 'detalle_manual_fin');

        await tester.tap(find.byTooltip('Más acciones'));
        await settle(tester, 4);
        expectReachable(tester, find.text('Editar venta'), what: '"Editar venta"');
        expectReachable(tester, find.text('Eliminar venta'), what: '"Eliminar venta"');
        await shoot(tester, 'detalle_manual_menu');
        await tester.tap(find.text('Ver comprobante'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al abrir el comprobante');
      });

      testWidgets('datos extremos en ${phone.name}: nada se desborda y se llega al final', (tester) async {
        await _openDetail(tester, phone: phone, sale: _onlineExtreme);
        await shoot(tester, 'detalle_extremo');
        for (var i = 0; i < 5; i++) {
          await tester.drag(_mainList(), const Offset(0, -430));
          await settle(tester, 3);
          expectNoLayoutErrors(tester, 'detalle extremo, tramo $i');
          await shoot(tester, 'detalle_extremo_$i');
        }
        await _toEnd(tester);
        await shoot(tester, 'detalle_extremo_fin');

        // La hoja de una acción con cliente y pedido de nombre largo.
        await _toStart(tester);
        await _tap(tester, find.text('Reembolsar'));
        expectNoLayoutErrors(tester, 'hoja con nombres largos');
        expectReachable(tester, _inSheet(find.text('Sí, reembolsar')), what: 'el botón de reembolsar');
        await shoot(tester, 'detalle_extremo_hoja');
        await tester.tap(_inSheet(find.text('Volver')));
        await settle(tester);

        // Eliminar: el título con nombre larguísimo no rompe el diálogo.
        await tester.tap(find.byTooltip('Más acciones'));
        await settle(tester, 4);
        await tester.tap(find.text('Eliminar pedido'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'diálogo de eliminar con nombres largos');
        expectReachable(tester, _inDialog(find.widgetWithText(FilledButton, 'Eliminar')), what: 'Eliminar');
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar');
      });

      testWidgets('campos nulos, estados finales, cargando y error en ${phone.name}', (tester) async {
        await _openDetail(tester, phone: phone, sale: _onlineBare);
        expect(find.text('Pedido'), findsOneWidget);
        expect(find.text('Cliente sin nombre'), findsOneWidget);
        expect(find.text('WhatsApp'), findsNothing, reason: 'sin teléfono no hay botones de contacto');
        await _toEnd(tester);
        await shoot(tester, 'detalle_nulos');

        await _openDetail(
          tester,
          phone: phone,
          sale: _manual(
            status: 'cancelled',
            who: _longName,
            category: _longCategory,
            cancelReason: 'El cliente se arrepintió a último momento porque consiguió el mismo producto más barato en otra feria',
          ),
        );
        expect(find.text('ACCIONES'), findsNothing);
        expect(find.textContaining('El cliente se arrepintió'), findsOneWidget);
        await shoot(tester, 'detalle_cancelada');
        await _toEnd(tester);
        expectNoLayoutErrors(tester, 'venta cancelada con textos largos');
        await shoot(tester, 'detalle_cancelada_fin');

        await _openDetail(tester, phone: phone, sale: _online(), saleLoader: () => Completer<SaleDetail>().future);
        expect(find.byType(Skeleton), findsWidgets);
        expect(find.byTooltip('Más acciones'), findsNothing, reason: 'sin datos no hay menú');

        await _openDetail(
          tester,
          phone: phone,
          sale: _online(),
          saleLoader: () => Future.error(ApiException('not_found', 'No encontramos el pedido.', status: 404)),
        );
        expect(find.text('No encontramos el pedido.'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar');
        await shoot(tester, 'detalle_error');
      });
    }

    testWidgets('WhatsApp y Llamar abren la app que corresponde', (tester) async {
      await _openDetail(tester, phone: Phone.small, sale: _online());
      await _tap(tester, find.text('WhatsApp'));
      await _tap(tester, find.text('Llamar'));
      expectNoLayoutErrors(tester, 'al tocar WhatsApp / Llamar');
      expect(_launched.length, 2, reason: 'cada botón abre su aplicación');
      expect(_launched.first, startsWith('https://wa.me/543757624148?text='));
      expect(_launched.last, 'tel:+543757624148');
    });

    testWidgets('un operador no ve cancelar ni reembolsar; solo lectura no ve acciones', (tester) async {
      await _openDetail(tester, phone: Phone.small, sale: _online(), me: _operator);
      expect(find.text('Marcar enviado'), findsOneWidget);
      expect(find.text('Cancelar'), findsNothing);
      expect(find.text('Reembolsar'), findsNothing);
      expect(find.text('Cancelar o reembolsar es solo para administradores.'), findsOneWidget);
      await shoot(tester, 'detalle_operador');
      await tester.tap(find.byTooltip('Más acciones'));
      await settle(tester, 4);
      expect(find.text('Eliminar pedido'), findsNothing);
      expect(find.text('Ver comprobante'), findsOneWidget);
      await tester.tapAt(const Offset(8, 300));
      await settle(tester, 4);

      await _openDetail(tester, phone: Phone.small, sale: _online(), me: _readOnly);
      expect(find.text('Tu cuenta puede ver los pedidos pero no modificarlos.'), findsOneWidget);
      expect(find.text('Marcar enviado'), findsNothing);
      await _toEnd(tester);
      await tester.drag(_mainList(), const Offset(0, 260));
      await settle(tester, 3);
      expect(find.text('Solo lectura con tu rol.'), findsOneWidget);
      expect(find.widgetWithText(GoldButton, 'Guardar'), findsNothing);
      await shoot(tester, 'detalle_solo_lectura');
    });

    testWidgets('letra grande (1,3×) en el teléfono chico: pantalla, cada hoja, menú y diálogo', (tester) async {
      await _openDetail(tester, phone: Phone.small, sale: _online(), textScale: 1.3);
      await shoot(tester, 'detalle_grande');
      for (var i = 0; i < 4; i++) {
        await tester.drag(_mainList(), const Offset(0, -400));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'detalle con letra grande, tramo $i');
        await shoot(tester, 'detalle_grande_$i');
      }
      await _toStart(tester);

      for (final (button, confirm) in [
        ('Marcar enviado', 'Confirmar'),
        ('Marcar entregado', 'Confirmar'),
        ('Cancelar', 'Sí, cancelar'),
        ('Reembolsar', 'Sí, reembolsar'),
      ]) {
        await _tap(tester, find.text(button));
        expectNoLayoutErrors(tester, 'hoja "$button" con letra grande');
        _expectSheetBelowStatusBar(tester);
        final main = _inSheet(find.text(confirm));
        expectReachable(tester, main, what: 'el botón "$confirm" con letra grande');
        expectReachable(tester, _inSheet(find.text('Volver')), what: 'Volver con letra grande');
        await shoot(tester, 'detalle_grande_hoja_${button.toLowerCase().replaceAll(' ', '_')}');
        for (final f in _inSheet(find.byType(TextField)).evaluate().toList()) {
          await _kbd(tester, find.byWidget(f.widget));
          expectFocusedFieldVisible(tester);
          _expectSheetBelowStatusBar(tester);
          expectReachable(tester, main, what: 'el botón "$confirm" con letra grande y teclado');
        }
        await shoot(tester, 'detalle_grande_hoja_${button.toLowerCase().replaceAll(' ', '_')}_teclado');
        await closeKeyboard(tester);
        await tester.tap(_inSheet(find.text('Volver')));
        await settle(tester);
      }

      await tester.tap(find.byTooltip('Más acciones'));
      await settle(tester, 4);
      expectNoLayoutErrors(tester, 'menú con letra grande');
      await shoot(tester, 'detalle_grande_menu');
      await tester.tap(find.text('Eliminar pedido'));
      await settle(tester, 4);
      expectNoLayoutErrors(tester, 'diálogo de eliminar con letra grande');
      expectReachable(tester, _inDialog(find.widgetWithText(FilledButton, 'Eliminar')), what: 'Eliminar con letra grande');
      expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar con letra grande');
      await shoot(tester, 'detalle_grande_eliminar');
    });

    testWidgets('letra grande (1,3×) con datos extremos', (tester) async {
      await _openDetail(tester, phone: Phone.small, sale: _onlineExtreme, textScale: 1.3);
      await shoot(tester, 'detalle_extremo_grande');
      for (var i = 0; i < 7; i++) {
        await tester.drag(_mainList(), const Offset(0, -430));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'detalle extremo con letra grande, tramo $i');
        await shoot(tester, 'detalle_extremo_grande_$i');
      }
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: pantalla, hoja de cancelar, menú y diálogo', (tester) async {
        await _openDetail(tester, phone: Phone.small, sale: _online(), theme: mode);
        await shoot(tester, 'detalle_${mode.name}');
        await tester.drag(_mainList(), const Offset(0, -420));
        await settle(tester, 3);
        await shoot(tester, 'detalle_2_${mode.name}');
        await _toStart(tester);
        await _tap(tester, find.text('Cancelar'));
        await shoot(tester, 'detalle_hoja_cancelar_${mode.name}');
        await tester.tap(_inSheet(find.text('Volver')));
        await settle(tester);
        await _tap(tester, find.widgetWithText(GoldButton, 'Marcar enviado'));
        await shoot(tester, 'detalle_hoja_enviado_${mode.name}');
        await tester.tap(_inSheet(find.text('Volver')));
        await settle(tester);
        await tester.tap(find.byTooltip('Más acciones'));
        await settle(tester, 4);
        await shoot(tester, 'detalle_menu_${mode.name}');
        await tester.tap(find.text('Eliminar pedido'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'detalle_eliminar_${mode.name}');
      });
    }
  });

  // =========================================================================
  group('Nueva venta de mostrador', () {
    for (final phone in Phone.both) {
      testWidgets('formulario vacío en ${phone.name}: primer y último campo con teclado, y el botón a mano', (tester) async {
        await _openNewSale(tester, phone: phone);
        final save = find.widgetWithText(GoldButton, 'Registrar venta');
        expectReachable(tester, save, what: 'el botón Registrar venta');
        expect(find.text('Falta el nombre del cliente.'), findsOneWidget);
        await shoot(tester, 'nueva');
        await _toEnd(tester);
        _expectAbove(tester, find.widgetWithText(ChoiceChip, 'Porta sahumerios'), save, reason: 'la última categoría');
        await shoot(tester, 'nueva_fin');

        // Primer campo.
        await _toStart(tester);
        await _kbd(tester, _field('Nombre del cliente'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Registrar venta con el teclado abierto');
        await _type(tester, _field('Nombre del cliente'), 'Marta');
        await settle(tester, 2);
        await shoot(tester, 'nueva_teclado_cliente');
        // Último campo.
        await _kbd(tester, _field('Nota o detalle (opcional)'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Registrar venta con el teclado en el último campo');
        await shoot(tester, 'nueva_teclado_detalle');
        await closeKeyboard(tester);
      });

      testWidgets('fecha en ${phone.name}: calendario propio, en castellano y con sus botones a mano', (tester) async {
        await _openNewSale(tester, phone: phone);
        await _tap(tester, find.byIcon(Icons.edit_calendar_outlined));
        expectNoLayoutErrors(tester, 'al abrir el calendario');
        expect(find.byType(DatePickerDialog), findsNothing, reason: 'el calendario es el propio de la app');
        expect(_inDialog(find.text('Fecha de la venta')), findsOneWidget);
        expectReachable(tester, _inDialog(find.text('Aceptar')), what: 'Aceptar del calendario');
        expectReachable(tester, _inDialog(find.text('Cancelar')), what: 'Cancelar del calendario');
        await shoot(tester, 'nueva_fecha');
        // Los días futuros (más allá de mañana) no se pueden elegir; se elige el 1.
        await tester.tap(_inDialog(find.byTooltip('Mes anterior')));
        await settle(tester, 2);
        await tester.tap(_inDialog(find.text('1')).first);
        await settle(tester, 2);
        await tester.tap(_inDialog(find.text('Aceptar')));
        await settle(tester);
        expect(find.byType(Dialog), findsNothing);
        expect(find.textContaining(' 1 de '), findsOneWidget, reason: 'la fecha elegida se ve en el formulario');
      });

      testWidgets('texto libre en ${phone.name}: hoja con sus tres campos y teclado', (tester) async {
        final ventas = _FakeVentas();
        await _openNewSale(tester, phone: phone, ventas: ventas);
        await _type(tester, _field('Nombre del cliente'), 'Marta');
        await _tap(tester, find.text('Texto libre'));
        expectNoLayoutErrors(tester, 'al abrir Texto libre');
        _expectSheetBelowStatusBar(tester);
        final add = _inSheet(find.byType(GoldButton));
        expectReachable(tester, add, what: 'el botón Agregar');
        await shoot(tester, 'nueva_libre_hoja');

        // Validación con la hoja tal cual.
        await tester.tap(add);
        await settle(tester, 3);
        expectReachable(tester, find.text('Poné qué se vendió.'), what: 'el aviso de qué falta');
        expectReachable(tester, add, what: 'el botón Agregar con el aviso');

        for (final (label, value) in [('Qué se vendió', 'Reparación de figura'), ('Precio c/u', '3000'), ('Costo c/u', '500')]) {
          await _kbd(tester, _inSheet(_field(label)));
          expectFocusedFieldVisible(tester);
          _expectSheetBelowStatusBar(tester);
          expectReachable(tester, add, what: 'el botón Agregar con el teclado en "$label"');
          await _type(tester, _inSheet(_field(label)), value);
          await settle(tester, 2);
        }
        await shoot(tester, 'nueva_libre_teclado');
        await tester.tap(add);
        await settle(tester);
        await closeKeyboard(tester);
        expect(find.byType(BottomSheet), findsNothing);
        expect(find.text('Reparación de figura'), findsOneWidget);
        expect(find.text('Texto libre · no descuenta stock'), findsOneWidget);
        await shoot(tester, 'nueva_con_linea');

        // Insumo extra: sus dos campos con teclado.
        await _tap(tester, find.text('Agregar insumo'), frames: 3);
        await _kbd(tester, _field('Insumo (ej: argollas)'));
        expectFocusedFieldVisible(tester);
        await _type(tester, _field('Insumo (ej: argollas)'), 'Argollas');
        final extraCost = find.descendant(
          of: find.ancestor(of: _field('Insumo (ej: argollas)'), matching: find.byType(Column)).first,
          matching: _field('Costo c/u'),
        );
        await _kbd(tester, extraCost);
        expectFocusedFieldVisible(tester);
        await _type(tester, extraCost, '150');
        await settle(tester, 2);
        final save = find.widgetWithText(GoldButton, 'Registrar venta');
        expectReachable(tester, save, what: 'Registrar venta con el teclado en un insumo');
        await shoot(tester, 'nueva_insumo_teclado');
        await closeKeyboard(tester);

        await tester.tap(save);
        await _nav(tester);
        expect(ventas.created, isNotNull);
        expect((ventas.created!['items'] as List).single, {
          'productName': 'Reparación de figura',
          'quantity': 1,
          'unitPrice': 3000.0,
          'unitCost': 500.0,
        });
        expect(ventas.created!['extras'], [
          {'name': 'Argollas', 'cost': 150.0, 'qty': 1},
        ]);
        expect(find.text('Registrar venta'), findsNothing, reason: 'volvió al listado');
        expect(find.textContaining('Venta registrada: Marta'), findsOneWidget);
        await shoot(tester, 'nueva_registrada_aviso');
      });

      testWidgets('catálogo en ${phone.name}: lista, hoja del producto con teclado y línea agregada', (tester) async {
        await _openNewSale(tester, phone: phone);
        await _type(tester, _field('Nombre del cliente'), 'Juan Pérez');
        await _tap(tester, find.text('Catálogo'));
        expect(find.text('Elegir producto'), findsOneWidget);
        expectNoLayoutErrors(tester, 'al abrir el catálogo');
        expectReachable(tester, find.text('Cerrar'), what: 'el botón Cerrar');
        await shoot(tester, 'catalogo');

        await _kbd(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'catalogo_teclado');
        await closeKeyboard(tester);

        await _tap(tester, find.text('Mate Mario'));
        expectNoLayoutErrors(tester, 'al abrir la hoja del producto');
        _expectSheetBelowStatusBar(tester);
        final add = _inSheet(find.byType(GoldButton));
        expectReachable(tester, add, what: 'el botón Agregar');
        await tester.tap(_inSheet(find.widgetWithText(ChoiceChip, 'Grande')));
        await tester.pump();
        await tester.tap(_inSheet(find.widgetWithText(ChoiceChip, 'Blanco')));
        await settle(tester, 3);
        expect(find.widgetWithText(TextField, '45000'), findsOneWidget, reason: 'el precio sigue al de la tienda');
        await shoot(tester, 'catalogo_hoja');

        await _kbd(tester, _inSheet(_field('Precio c/u')));
        expectFocusedFieldVisible(tester);
        _expectSheetBelowStatusBar(tester);
        expectReachable(tester, add, what: 'el botón Agregar con el teclado abierto');
        await shoot(tester, 'catalogo_hoja_teclado');
        await tester.tap(add);
        await settle(tester);
        await closeKeyboard(tester);
        expect(find.byType(BottomSheet), findsNothing);
        expect(find.text('Agregado: Mate Mario'), findsOneWidget);
        expectReachable(tester, find.text('Listo (1)'), what: 'el botón Listo');
        await shoot(tester, 'catalogo_agregado');

        await tester.tap(find.text('Listo (1)'));
        await settle(tester);
        expect(find.text('Grande · Blanco'), findsOneWidget);
        expect(find.text('Descuenta stock'), findsOneWidget);
        // El precio de la línea con teclado.
        await _kbd(tester, _field('Precio c/u'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Registrar venta'), what: 'Registrar venta con el teclado en el precio');
        await shoot(tester, 'nueva_linea_catalogo_teclado');
        await closeKeyboard(tester);
      });

      testWidgets('catálogo con 36 productos y un producto con 12 tamaños y 14 colores en ${phone.name}', (tester) async {
        await _openNewSale(tester, phone: phone, catalog: _catalogMany, formData: _formDataExtreme);
        await _tap(tester, find.text('Catálogo'));
        expectNoLayoutErrors(tester, 'catálogo largo');
        await shoot(tester, 'catalogo_largo');
        await _toEnd(tester);
        expectReachable(tester, find.textContaining('Mostrando 36 de 57'), what: 'el pie del catálogo');
        await shoot(tester, 'catalogo_largo_fin');
        await _toStart(tester);

        await _tap(tester, find.textContaining('Set de mates personalizados'));
        expectNoLayoutErrors(tester, 'hoja con muchos tamaños y colores');
        _expectSheetBelowStatusBar(tester);
        final add = _inSheet(find.byType(GoldButton));
        expectReachable(tester, add, what: 'el botón Agregar con la hoja llena');
        await shoot(tester, 'catalogo_hoja_larga');
        // Se llega al último color y al campo de precio desplazando la hoja.
        await tester.ensureVisible(_inSheet(find.widgetWithText(ChoiceChip, 'Transparente')));
        await settle(tester, 2);
        await tester.tap(_inSheet(find.widgetWithText(ChoiceChip, 'Transparente')));
        await settle(tester, 2);
        await _kbd(tester, _inSheet(_field('Precio c/u')));
        expectFocusedFieldVisible(tester);
        _expectSheetBelowStatusBar(tester);
        expectReachable(tester, add, what: 'el botón Agregar con teclado y la hoja llena');
        await shoot(tester, 'catalogo_hoja_larga_teclado');
        // Sin precio no agrega y el aviso queda a la vista (aunque la hoja
        // esté desplazada hasta arriba).
        await closeKeyboard(tester);
        await _type(tester, _inSheet(_field('Precio c/u')), '');
        await tester.ensureVisible(_inSheet(find.widgetWithText(ChoiceChip, 'Chico')));
        await settle(tester, 2);
        await tester.tap(add);
        await settle(tester, 5);
        expect(find.byType(BottomSheet), findsOneWidget, reason: 'sin precio no se agrega');
        expectReachable(tester, find.text('Poné el precio.'), what: 'el aviso de que falta el precio');
        await shoot(tester, 'catalogo_hoja_larga_sin_precio');
        await _type(tester, _inSheet(_field('Precio c/u')), '123456789');
        await tester.tap(add);
        await settle(tester);
        await closeKeyboard(tester);
        await tester.tap(find.text('Listo (1)'));
        await settle(tester);

        // De vuelta en la venta: total de 9 cifras + costo a mano (sin carrete).
        expectNoLayoutErrors(tester, 'venta con total de 9 cifras');
        expect(find.text('Sin carrete: cargá el costo'), findsOneWidget);
        final save = find.widgetWithText(GoldButton, 'Registrar venta');
        expectReachable(tester, save, what: 'Registrar venta con un total de 9 cifras');
        _expectOneLine(tester, find.descendant(of: save, matching: find.text('Registrar venta')), what: 'el rótulo "Registrar venta"');
        await shoot(tester, 'nueva_extremo');
        await _kbd(tester, _field('Costo c/u'));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'nueva_extremo_teclado_costo');
        await closeKeyboard(tester);
        await _toEnd(tester);
        expectNoLayoutErrors(tester, 'venta extrema al final');
        await shoot(tester, 'nueva_extremo_fin');
      });

      testWidgets('catálogo vacío y con error en ${phone.name}', (tester) async {
        await _openNewSale(tester, phone: phone, catalog: SaleCatalogPage.fromJson({'total': 0, 'items': <dynamic>[]}));
        await _tap(tester, find.text('Catálogo'));
        expect(find.text('No encontramos productos'), findsOneWidget);
        await shoot(tester, 'catalogo_vacio');
        await _kbd(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        await closeKeyboard(tester);
        await tester.tap(find.text('Cerrar'));
        await settle(tester);

        await _openNewSale(
          tester,
          phone: phone,
          catalogLoader: () => Future.error(ApiException('forbidden', 'No tenés permiso para hacer esto.', status: 403)),
        );
        await _tap(tester, find.text('Catálogo'));
        expect(find.text('No tenés permiso para hacer esto.'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar');
        await shoot(tester, 'catalogo_error');
      });

      testWidgets('error del servidor y salir con datos cargados en ${phone.name}', (tester) async {
        final ventas = _FakeVentas()
          ..failWith = ApiException(
            'invalid',
            'El producto «Mate Mario» ya no está en el catálogo. Sacalo de la venta o cargalo como texto libre.',
            status: 422,
          );
        await _openNewSale(tester, phone: phone, ventas: ventas);
        await _type(tester, _field('Nombre del cliente'), 'Ana');
        await _tap(tester, find.text('Texto libre'));
        await _type(tester, _inSheet(_field('Qué se vendió')), 'Algo');
        await _type(tester, _inSheet(_field('Precio c/u')), '1000');
        await _type(tester, _inSheet(_field('Costo c/u')), '0');
        await tester.tap(_inSheet(find.byType(GoldButton)));
        await settle(tester);

        final save = find.widgetWithText(GoldButton, 'Registrar venta');
        await tester.tap(save);
        await settle(tester);
        expect(find.textContaining('ya no está en el catálogo'), findsOneWidget);
        expectReachable(tester, save, what: 'Registrar venta con el error del servidor a la vista');
        expectReachable(tester, find.textContaining('ya no está en el catálogo'), what: 'el error del servidor');
        await shoot(tester, 'nueva_error_servidor');

        // "Atrás" del sistema con datos cargados: pregunta antes de perderlos.
        await tester.binding.handlePopRoute();
        await settle(tester);
        expect(find.text('¿Descartar la venta?'), findsOneWidget);
        expectNoLayoutErrors(tester, 'diálogo de descartar');
        expectReachable(tester, _inDialog(find.text('Seguir cargando')), what: 'Seguir cargando');
        expectReachable(tester, _inDialog(find.text('Descartar')), what: 'Descartar');
        await shoot(tester, 'nueva_descartar');
        await tester.tap(_inDialog(find.text('Seguir cargando')));
        await settle(tester);
        expect(find.text('Registrar venta'), findsOneWidget);
        // La flecha de la barra también pregunta; "Descartar" sale.
        await tester.tap(find.byTooltip('Atrás'));
        await settle(tester);
        await tester.tap(_inDialog(find.text('Descartar')));
        await _nav(tester);
        expect(find.text('Registrar venta'), findsNothing);
        expect(find.text('4 ventas'), findsOneWidget);
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico: formulario, hojas, catálogo y calendario', (tester) async {
      await _openNewSale(tester, phone: Phone.small, textScale: 1.3, catalog: _catalogMany, formData: _formDataExtreme);
      final save = find.widgetWithText(GoldButton, 'Registrar venta');
      expectReachable(tester, save, what: 'Registrar venta con letra grande');
      await shoot(tester, 'nueva_grande');
      for (var i = 0; i < 4; i++) {
        await tester.drag(_mainList(), const Offset(0, -260));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'formulario con letra grande, tramo $i');
        await shoot(tester, 'nueva_grande_$i');
      }
      await _toStart(tester);
      await _kbd(tester, _field('Nombre del cliente'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'Registrar venta con letra grande y teclado');
      await shoot(tester, 'nueva_grande_teclado');
      await _kbd(tester, _field('Nota o detalle (opcional)'));
      expectFocusedFieldVisible(tester);
      await closeKeyboard(tester);
      await _toStart(tester);

      // Calendario.
      await _tap(tester, find.byIcon(Icons.edit_calendar_outlined));
      expectNoLayoutErrors(tester, 'calendario con letra grande');
      expectReachable(tester, _inDialog(find.text('Aceptar')), what: 'Aceptar del calendario con letra grande');
      await shoot(tester, 'nueva_grande_fecha');
      await tester.tap(_inDialog(find.text('Cancelar')));
      await settle(tester);

      // Texto libre.
      await _tap(tester, find.text('Texto libre'));
      expectNoLayoutErrors(tester, 'texto libre con letra grande');
      _expectSheetBelowStatusBar(tester);
      var add = _inSheet(find.byType(GoldButton));
      expectReachable(tester, add, what: 'Agregar con letra grande');
      await shoot(tester, 'nueva_grande_libre');
      for (final label in ['Qué se vendió', 'Precio c/u', 'Costo c/u']) {
        await _kbd(tester, _inSheet(_field(label)));
        expectFocusedFieldVisible(tester);
        _expectSheetBelowStatusBar(tester);
        expectReachable(tester, add, what: 'Agregar con letra grande y teclado en "$label"');
      }
      await shoot(tester, 'nueva_grande_libre_teclado');
      await closeKeyboard(tester);
      // Con letra grande la hoja ocupa todo el alto: se cierra con "atrás".
      await tester.binding.handlePopRoute();
      await settle(tester);
      expect(find.byType(BottomSheet), findsNothing, reason: '"atrás" cierra la hoja');

      // Catálogo.
      await _tap(tester, find.text('Catálogo'));
      expectNoLayoutErrors(tester, 'catálogo con letra grande');
      await shoot(tester, 'catalogo_grande');
      await tester.drag(_mainList(), const Offset(0, -420));
      await settle(tester, 3);
      expectNoLayoutErrors(tester, 'catálogo con letra grande, desplazado');
      await shoot(tester, 'catalogo_grande_2');
      await _toStart(tester);
      await _tap(tester, find.textContaining('Set de mates personalizados'));
      expectNoLayoutErrors(tester, 'hoja del producto con letra grande');
      _expectSheetBelowStatusBar(tester);
      add = _inSheet(find.byType(GoldButton));
      expectReachable(tester, add, what: 'Agregar con letra grande y la hoja llena');
      await shoot(tester, 'catalogo_grande_hoja');
      await _kbd(tester, _inSheet(_field('Precio c/u')));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, add, what: 'Agregar con letra grande, hoja llena y teclado');
      await shoot(tester, 'catalogo_grande_hoja_teclado');
      await tester.tap(add);
      await settle(tester);
      await closeKeyboard(tester);
      await tester.tap(find.textContaining('Listo'));
      await settle(tester);
      expectNoLayoutErrors(tester, 'venta con total de 9 cifras y letra grande');
      expectReachable(tester, save, what: 'Registrar venta con total de 9 cifras y letra grande');
      _expectOneLine(tester, find.descendant(of: save, matching: find.text('Registrar venta')), what: 'el rótulo "Registrar venta" con letra grande');
      await shoot(tester, 'nueva_grande_extremo');
      await _toEnd(tester);
      expectNoLayoutErrors(tester);
      await shoot(tester, 'nueva_grande_extremo_fin');
    });

    for (final mode in HefestoThemeMode.values) {
      testWidgets('tema ${mode.name}: formulario, hoja del producto (chips elegidos legibles) y texto libre', (tester) async {
        await _openNewSale(tester, phone: Phone.small, theme: mode);
        await shoot(tester, 'nueva_${mode.name}');
        await _toEnd(tester);
        await shoot(tester, 'nueva_fin_${mode.name}');
        await _toStart(tester);
        await _tap(tester, find.text('Texto libre'));
        await shoot(tester, 'nueva_libre_${mode.name}');
        await tester.tapAt(const Offset(180, 40));
        await settle(tester);
        await _tap(tester, find.text('Catálogo'));
        await shoot(tester, 'catalogo_${mode.name}');
        await _tap(tester, find.text('Mate Mario'));
        await tester.tap(_inSheet(find.widgetWithText(ChoiceChip, 'Grande')));
        await tester.pump();
        await tester.tap(_inSheet(find.widgetWithText(ChoiceChip, 'Blanco')));
        await settle(tester, 4);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'catalogo_hoja_${mode.name}');

        // El chip elegido tiene que leerse: el texto contrasta con su fondo.
        final c = AppTheme.colorsOf(mode);
        final chip = _inSheet(find.widgetWithText(ChoiceChip, 'Grande'));
        final label = tester.renderObject<RenderParagraph>(find.descendant(of: chip, matching: find.text('Grande')));
        final textColor = label.text.style!.color!;
        final theme = AppTheme.of(mode).chipTheme;
        final fill = Color.alphaBlend(theme.selectedColor!, c.surface1);
        expect(
          _contrast(textColor, fill) >= 4.5,
          isTrue,
          reason: 'chip elegido ilegible en ${mode.name}: texto $textColor sobre $fill '
              '(contraste ${_contrast(textColor, fill).toStringAsFixed(1)})',
        );
      });
    }
  });

  // =========================================================================
  group('Editar venta de mostrador', () {
    Future<void> openEdit(
      WidgetTester tester, {
      required Phone phone,
      double textScale = 1,
      HefestoThemeMode theme = HefestoThemeMode.dark,
      _FakeVentas? ventas,
      ManualSaleEditData? edit,
      Future<ManualSaleEditData> Function()? editLoader,
    }) async {
      await _openDetail(
        tester,
        phone: phone,
        sale: _manual(),
        textScale: textScale,
        theme: theme,
        ventas: ventas,
        edit: edit,
        editLoader: editLoader,
      );
      await tester.tap(find.byTooltip('Más acciones'));
      await settle(tester, 4);
      await tester.tap(find.text('Editar venta'));
      await settle(tester);
      expect(find.descendant(of: find.byType(AppBar), matching: find.text('Editar venta')), findsOneWidget);
      expectNoLayoutErrors(tester, 'al abrir Editar venta');
    }

    for (final phone in Phone.both) {
      testWidgets('formulario en ${phone.name}: primer y último campo con teclado, fecha y guardar', (tester) async {
        final ventas = _FakeVentas();
        await openEdit(tester, phone: phone, ventas: ventas);
        final save = find.widgetWithText(GoldButton, 'Guardar cambios');
        expectReachable(tester, save, what: 'el botón Guardar cambios');
        await shoot(tester, 'editar');
        await _toEnd(tester);
        _expectAbove(tester, find.text('Ganancia (total − costo)'), save, reason: 'la ganancia (lo último)');
        await shoot(tester, 'editar_fin');

        await _toStart(tester);
        await _kbd(tester, _field('Nombre del cliente'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Guardar cambios con el teclado abierto');
        await shoot(tester, 'editar_teclado_cliente');
        for (final label in ['Detalle', 'Categoría (opcional)', 'Total cobrado', 'Costo (material + insumos)']) {
          await _kbd(tester, _field(label));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, save, what: 'Guardar cambios con el teclado en "$label"');
        }
        await _type(tester, _field('Costo (material + insumos)'), '4000');
        await settle(tester, 2);
        await shoot(tester, 'editar_teclado_costo');
        await closeKeyboard(tester);

        // Fecha: calendario propio.
        await _toStart(tester);
        await _tap(tester, find.byIcon(Icons.edit_calendar_outlined));
        expect(find.byType(DatePickerDialog), findsNothing, reason: 'el calendario es el propio de la app');
        expect(_inDialog(find.text('Fecha de la venta')), findsOneWidget);
        expectReachable(tester, _inDialog(find.text('Aceptar')), what: 'Aceptar del calendario');
        await shoot(tester, 'editar_fecha');
        await tester.tap(_inDialog(find.text('15')));
        await settle(tester, 2);
        await tester.tap(_inDialog(find.text('Aceptar')));
        await settle(tester);

        await tester.tap(save);
        await _nav(tester);
        expect(ventas.edited, {
          'id': 'm1',
          'saleDate': '2026-10-15',
          'customerName': 'Cliente de feria',
          'detail': '5 llaveros personalizados',
          'category': 'Llaveros',
          'total': 10000.0,
          'amortization': 4000.0,
          'paymentMethod': 'cash',
        });
        expect(find.text('Guardar cambios'), findsNothing, reason: 'volvió al detalle');
        expect(find.text('Venta actualizada'), findsOneWidget);
      });

      testWidgets('errores en ${phone.name}: al cargar, al guardar y salir con cambios sin guardar', (tester) async {
        await openEdit(
          tester,
          phone: phone,
          editLoader: () => Future.error(ApiException('not_found', 'No encontramos la venta.', status: 404)),
        );
        expect(find.text('No encontramos la venta.'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar');
        await shoot(tester, 'editar_error_carga');

        final ventas = _FakeVentas()..failWith = ApiException('invalid', 'Ingresá el total cobrado.', status: 422);
        await openEdit(tester, phone: phone, ventas: ventas, edit: _editData(who: _longName, detail: _longProduct, total: 987654321));
        final save = find.widgetWithText(GoldButton, 'Guardar cambios');
        await _reveal(tester, _field('Total cobrado'));
        await _type(tester, _field('Total cobrado'), '987.654.320');
        await tester.tap(save);
        await settle(tester);
        expect(find.text('Ingresá el total cobrado.'), findsOneWidget);
        expectReachable(tester, save, what: 'Guardar cambios con el error del servidor');
        expectNoLayoutErrors(tester, 'editar con datos largos y error');
        await shoot(tester, 'editar_error_guardar');
        await _toEnd(tester);
        await shoot(tester, 'editar_extremo_fin');

        // Salir con cambios sin guardar pregunta antes de perderlos.
        await tester.binding.handlePopRoute();
        await settle(tester);
        expect(find.text('¿Descartar los cambios?'), findsOneWidget, reason: 'salir con cambios tiene que avisar');
        expectReachable(tester, _inDialog(find.text('Seguir editando')), what: 'Seguir editando');
        expectReachable(tester, _inDialog(find.text('Descartar')), what: 'Descartar');
        await shoot(tester, 'editar_descartar');
        await tester.tap(_inDialog(find.text('Seguir editando')));
        await settle(tester);
        expect(find.text('Guardar cambios'), findsOneWidget);
        await tester.tap(find.byTooltip('Atrás'));
        await settle(tester);
        await tester.tap(_inDialog(find.text('Descartar')));
        await _nav(tester);
        expect(find.text('Guardar cambios'), findsNothing);
        expect(find.text('Detalle'), findsOneWidget);
      });
    }

    testWidgets('sin cambios, "atrás" sale directo', (tester) async {
      await openEdit(tester, phone: Phone.small);
      await tester.binding.handlePopRoute();
      await settle(tester);
      expect(find.byType(Dialog), findsNothing);
      expect(find.text('Detalle'), findsOneWidget);
    });

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      await openEdit(tester, phone: Phone.small, textScale: 1.3);
      final save = find.widgetWithText(GoldButton, 'Guardar cambios');
      expectReachable(tester, save, what: 'Guardar cambios con letra grande');
      await shoot(tester, 'editar_grande');
      for (var i = 0; i < 3; i++) {
        await tester.drag(_mainList(), const Offset(0, -300));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'editar con letra grande, tramo $i');
        await shoot(tester, 'editar_grande_$i');
      }
      for (final label in ['Nombre del cliente', 'Costo (material + insumos)']) {
        await _kbd(tester, _field(label));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Guardar cambios con letra grande y teclado en "$label"');
      }
      await shoot(tester, 'editar_grande_teclado');
      await closeKeyboard(tester);
      await _toStart(tester);
      await _tap(tester, find.byIcon(Icons.edit_calendar_outlined));
      expectNoLayoutErrors(tester, 'calendario con letra grande');
      expectReachable(tester, _inDialog(find.text('Aceptar')), what: 'Aceptar con letra grande');
      await shoot(tester, 'editar_grande_fecha');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}', (tester) async {
        await openEdit(tester, phone: Phone.small, theme: mode);
        await shoot(tester, 'editar_${mode.name}');
        await _toEnd(tester);
        await shoot(tester, 'editar_fin_${mode.name}');
        await _toStart(tester);
        await _tap(tester, find.byIcon(Icons.edit_calendar_outlined));
        await shoot(tester, 'editar_fecha_${mode.name}');
      });
    }
  });

  // =========================================================================
  group('Más', () {
    for (final phone in Phone.both) {
      testWidgets('todos los módulos en ${phone.name}: se llega al último y cada uno abre su pantalla', (tester) async {
        await _openPanel(tester, phone: phone, at: '/admin/mas');
        for (final m in adminModules.take(3)) {
          expect(find.text(m.title), findsOneWidget);
        }
        await shoot(tester, 'mas');
        await _toEnd(tester);
        _expectAbove(tester, find.text('Volver a la tienda'), find.byType(NavigationBar), reason: '"Volver a la tienda"');
        expectReachable(tester, find.text('Auditoría'), what: 'el último módulo');
        await shoot(tester, 'mas_fin');

        // Un módulo se abre SOBRE la barra del panel y vuelve.
        await _tap(tester, find.text('Auditoría'));
        expect(find.text('pantalla: Módulo auditoria'), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);
        await tester.tap(find.byTooltip('Atrás'));
        await settle(tester);
        expect(find.text('Auditoría'), findsOneWidget);

        // Filamentos (el stock) es un módulo más: se abre sobre la barra.
        await _toStart(tester);
        await _tap(tester, find.text('Filamentos'));
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Filamentos')), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);
        await tester.tap(find.byTooltip('Atrás'));
        await settle(tester);

        // La cola es una pestaña del panel: desde "Más" se salta a ella.
        await _tap(tester, find.text('Cola de impresión'));
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Cola')), findsOneWidget);
        expect(find.byType(NavigationBar), findsOneWidget);

        // Volver a la tienda.
        await tester.tap(_inNavBar('Más'));
        await settle(tester);
        await _toEnd(tester);
        await _tap(tester, find.text('Volver a la tienda'));
        expect(find.text('pantalla: Cuenta'), findsOneWidget);
      });
    }

    testWidgets('con pocos permisos muestra solo esos módulos; sin ninguno, "Sin acceso"', (tester) async {
      await _openPanel(tester, phone: Phone.small, at: '/admin/mas', me: staffWith(const ['clientes', 'reportes'], role: 'operator'));
      expect(find.text('Clientes'), findsOneWidget);
      expect(find.text('Reportes'), findsOneWidget);
      expect(find.text('Productos'), findsNothing);
      expect(find.text('Configuración'), findsNothing);
      await shoot(tester, 'mas_pocos');

      await _openPanel(tester, phone: Phone.small, at: '/admin/mas', me: staffWith(const [], role: 'operator'));
      expect(find.text('Sin acceso'), findsOneWidget);
      await _toEnd(tester);
      _expectAbove(tester, find.text('Volver a la tienda'), find.byType(NavigationBar), reason: '"Volver a la tienda"');
      await shoot(tester, 'mas_sin_modulos');
    });

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      await _openPanel(tester, phone: Phone.small, at: '/admin/mas', textScale: 1.3);
      await shoot(tester, 'mas_grande');
      await tester.drag(_mainList(), const Offset(0, -420));
      await settle(tester, 3);
      expectNoLayoutErrors(tester);
      await shoot(tester, 'mas_grande_2');
      await _toEnd(tester);
      _expectAbove(tester, find.text('Volver a la tienda'), find.byType(NavigationBar), reason: '"Volver a la tienda"');
      await shoot(tester, 'mas_grande_fin');
    });
  });

  // =========================================================================
  // CONSULTAS: listado, mensaje para el cliente, responder y alta con fotos
  // =========================================================================
  group('Pendientes del equipo', () {
    /// 14 abiertos (uno larguísimo, de 500 letras) y 20 hechos.
    PendientesData many() => PendientesData.fromJson({
          'open': [
            taskJson('largo', body: ('$_longProduct. ' * 5).substring(0, 500), author: _longName, mine: true),
            for (var i = 0; i < 13; i++)
              taskJson('o$i', body: 'Pendiente número $i del equipo', author: i.isEven ? 'Agustín' : 'Antonella', mine: i % 3 == 0),
          ],
          'done': [
            for (var i = 0; i < 20; i++)
              taskJson('d$i', body: i == 0 ? _longProduct : 'Hecho número $i', done: true, doneBy: i == 0 ? _longName : 'Ale', mine: i.isOdd),
          ],
          'maxLength': 500,
        });

    final input = find.byType(TextField);
    final send = find.widgetWithIcon(IconButton, Icons.send_rounded);

    /// Ventas → "Pendientes del equipo · N" (el camino real).
    Future<FakePendientesApi> openFromSales(
      WidgetTester tester,
      Phone phone, {
      PendientesData? data,
      MeInfo? me,
      double textScale = 1,
      HefestoThemeMode theme = HefestoThemeMode.dark,
    }) async {
      final api = FakePendientesApi(data);
      await _openPanel(tester,
          phone: phone, at: '/admin/ventas', me: me, textScale: textScale, theme: theme, world: _world(pendientes: api));
      final entry = find.textContaining('Pendientes del equipo · ');
      expectReachable(tester, entry, what: 'la entrada a los pendientes');
      await tester.tap(entry);
      await _nav(tester);
      expectNoLayoutErrors(tester, 'al abrir los pendientes');
      expect(find.byType(PendientesScreen), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing, reason: 'los pendientes se abren sobre la barra del panel');
      return api;
    }

    for (final phone in Phone.both) {
      testWidgets('lista, anotar con el teclado, tildar y hechos en ${phone.name}', (tester) async {
        final api = await openFromSales(tester, phone);
        expect(find.text('3 pendientes'), findsOneWidget);
        expectReachable(tester, input, what: 'el campo para anotar');
        expectReachable(tester, send, what: 'el botón de anotar');
        await shoot(tester, 'pendientes');

        // Anotar: el campo queda arriba del teclado, con su botón.
        await openKeyboard(tester, input);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, send, what: 'el botón de anotar con el teclado');
        await _type(tester, input, 'Cargar el pedido de la feria del sábado, con los 12 llaveros y las 3 macetas que quedaron sin anotar');
        expectNoLayoutErrors(tester);
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'pendientes_teclado');
        await tester.tap(send);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.created, hasLength(1));
        expect(find.text('4 pendientes'), findsOneWidget);
        await closeKeyboard(tester);

        // Tildar uno: aviso y pasa a "Hechos".
        await _tap(tester, find.descendant(of: find.byKey(const ValueKey('pendiente-t2')), matching: find.byType(Checkbox)));
        expectNoLayoutErrors(tester);
        expect(find.text('Pendiente hecho'), findsOneWidget);
        await shoot(tester, 'pendientes_tildado');
        await _tap(tester, find.text('Hechos (3)'));
        expectNoLayoutErrors(tester);
        await _toEnd(tester);
        _expectAbove(tester, find.text('Reponer bolsas'), input, reason: 'el último hecho (no lo tapa el campo de anotar)');
        await shoot(tester, 'pendientes_hechos');
      });

      testWidgets('muchos y larguísimos en ${phone.name}: se lee entero y se borra con confirmación', (tester) async {
        final api = await openFromSales(tester, phone, data: many());
        expect(find.text('14 pendientes'), findsOneWidget);
        // El de 500 letras se lee entero (no se corta).
        final long = find.descendant(of: find.byKey(const ValueKey('pendiente-largo')), matching: find.textContaining(_longProduct));
        expect(tester.renderObject<RenderParagraph>(long).didExceedMaxLines, isFalse);
        await shoot(tester, 'pendientes_muchos');

        // Borrar el larguísimo: el diálogo se desplaza y los botones quedan a mano.
        await _tap(tester, find.descendant(of: find.byKey(const ValueKey('pendiente-largo')), matching: find.byTooltip('Borrar pendiente')));
        expectNoLayoutErrors(tester);
        expect(find.text('¿Borrar este pendiente?'), findsOneWidget);
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Borrar')), what: 'Borrar');
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar');
        await shoot(tester, 'pendientes_borrar_dialogo');
        await tester.tap(_inDialog(find.widgetWithText(TextButton, 'Borrar')));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.deleted, ['largo']);
        await _reveal(tester, find.text('13 pendientes'));

        // Los 20 hechos: el último queda arriba del campo de anotar.
        await _toEnd(tester);
        await _tap(tester, find.text('Hechos (20)'));
        await _toEnd(tester);
        _expectAbove(tester, find.text('Hecho número 19'), input, reason: 'el último hecho');
        await shoot(tester, 'pendientes_muchos_fin');
      });

      testWidgets('vacío, rechazo al anotar con el teclado y solo lectura en ${phone.name}', (tester) async {
        final api = await openFromSales(tester, phone, data: const PendientesData(open: [], done: []));
        expect(find.text('Nada pendiente'), findsOneWidget);
        await shoot(tester, 'pendientes_vacio');
        api.failWith = ApiException('invalid', _longServerError);
        await openKeyboard(tester, input);
        await _type(tester, input, 'Llamar a Nico');
        await tester.tap(send);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text(_longServerError), what: 'el rechazo del servidor (con el teclado abierto)');
        expectFocusedFieldVisible(tester);
        expectReachable(tester, send, what: 'el botón de anotar con el rechazo a la vista');
        await shoot(tester, 'pendientes_error');
        await closeKeyboard(tester);

        // Quien solo mira: sin campo para anotar, la lista usa todo el alto.
        await openFromSales(tester, phone, data: many(), me: _readOnly);
        expect(input, findsNothing);
        await _toEnd(tester);
        await _tap(tester, find.text('Hechos (20)'));
        await _toEnd(tester);
        expectReachable(tester, find.text('Hecho número 19'), what: 'el último hecho');
        await shoot(tester, 'pendientes_solo_lectura');
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      final api = await openFromSales(tester, Phone.small, data: many(), textScale: 1.3);
      await shoot(tester, 'pendientes_grande');
      await openKeyboard(tester, input);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, send, what: 'el botón de anotar con letra grande y teclado');
      await shoot(tester, 'pendientes_grande_teclado');
      await closeKeyboard(tester);
      await _tap(tester, find.descendant(of: find.byKey(const ValueKey('pendiente-largo')), matching: find.byTooltip('Borrar pendiente')));
      expectNoLayoutErrors(tester);
      expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Borrar')), what: 'Borrar con letra grande');
      expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar con letra grande');
      await shoot(tester, 'pendientes_borrar_dialogo_grande');
      await tester.tap(_inDialog(find.widgetWithText(TextButton, 'Cancelar')));
      await settle(tester);
      expect(api.deleted, isEmpty);
      await _toEnd(tester);
      await _tap(tester, find.text('Hechos (20)'));
      await _toEnd(tester);
      _expectAbove(tester, find.text('Hecho número 19'), input, reason: 'el último hecho con letra grande');
      await shoot(tester, 'pendientes_grande_fin');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}', (tester) async {
        await openFromSales(tester, Phone.small, theme: mode);
        await _tap(tester, find.text('Hechos (2)'));
        await shoot(tester, 'pendientes_${mode.name}');
      });
    }
  });

  // =========================================================================
  group('Consultas', () {
    final me = staffWith(['consultas']);
    List<Override> ov(ConsultasData d, [ConsultasApi? api, PhotoSource? photos, AttachmentSource? files]) => [
          consultasProvider.overrideWith((ref) async => d),
          if (api != null) consultasApiProvider.overrideWithValue(api),
          if (photos != null) photoSourceProvider.overrideWithValue(photos),
          if (files != null) attachmentSourceProvider.overrideWithValue(files),
          // "Calcular precio": tipos y filamentos de ejemplo, precio fijo.
          ...estimatorOverrides(FakeEstimatorApi(), overview: sampleEstimatorOverview(longName: _longCategory)),
        ];
    final fab = find.widgetWithText(FloatingActionButton, 'Nueva consulta');
    final usePrice = find.widgetWithText(GoldButton, 'Usar este precio');

    /// Abre "Calcular precio" (o "Volver a calcular"), revisa la hoja con el
    /// teclado en cada campo y usa el precio.
    Future<void> calculate(WidgetTester tester, String shot, {String button = 'Calcular precio'}) async {
      await _tap(tester, find.widgetWithText(OutlinedButton, button));
      expectNoLayoutErrors(tester);
      expect(find.byType(PriceEstimatorSheet), findsOneWidget);
      _expectSheetBelowStatusBar(tester);
      expectReachable(tester, usePrice, what: 'Usar este precio');
      await shoot(tester, '${shot}_hoja');
      for (final (label, text) in [('Gramos por unidad', '123.456,75'), ('Horas', '999'), ('Minutos', '59')]) {
        await openKeyboard(tester, _inSheet(_field(label)));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, usePrice, what: 'Usar este precio con el teclado ($label)');
        _expectSheetBelowStatusBar(tester);
        await _type(tester, _inSheet(_field(label)), text);
        expectNoLayoutErrors(tester);
      }
      await shoot(tester, '${shot}_hoja_teclado');
      await closeKeyboard(tester);
      // El tipo de nombre más largo (lo último de la hoja) se puede tocar.
      final chip = _inSheet(find.widgetWithText(ChoiceChip, _longCategory));
      await tester.ensureVisible(chip);
      await settle(tester, 3);
      await tester.tap(chip);
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expect(tester.widget<Text>(find.byKey(const ValueKey('estimator-price'))).data, r'$2.900');
      expectReachable(tester, usePrice, what: 'Usar este precio con el precio calculado');
      await shoot(tester, '${shot}_hoja_precio');
      await tester.tap(usePrice);
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expect(find.byType(PriceEstimatorSheet), findsNothing);
    }
    final saveAnswer = find.widgetWithText(GoldButton, 'Guardar respuesta');
    final saveNew = find.widgetWithText(GoldButton, 'Cargar consulta');

    /// Trae el campo a la vista (las listas arman sus filas de a poco) y escribe.
    Future<void> fill(WidgetTester tester, String label, String text) async {
      await _reveal(tester, _field(label));
      await _type(tester, _field(label), text);
    }

    Future<void> openList(
      WidgetTester tester,
      Phone phone,
      ConsultasData d, {
      ConsultasApi? api,
      PhotoSource? photos,
      AttachmentSource? files,
      MeInfo? who,
      double textScale = 1,
      HefestoThemeMode theme = HefestoThemeMode.dark,
    }) =>
        pumpPhone(tester, const AdminConsultasScreen(),
            phone: phone, theme: theme, textScale: textScale, me: who ?? me, overrides: ov(d, api, photos, files));

    Future<void> openAnswer(
      WidgetTester tester,
      Phone phone,
      Consulta q, {
      ConsultasApi? api,
      double textScale = 1,
      HefestoThemeMode theme = HefestoThemeMode.dark,
    }) =>
        pumpPhone(tester, ConsultaAnswerScreen(consulta: q),
            phone: phone, theme: theme, textScale: textScale, me: me, overrides: ov(_smallConsultas(), api ?? FakeConsultasApi()));

    for (final phone in Phone.both) {
      testWidgets('listado largo con datos extremos en ${phone.name}', (tester) async {
        await openList(tester, phone, _bigConsultas());
        expect(find.descendant(of: find.byType(AppBar), matching: find.text('Consultas')), findsOneWidget);
        expectReachable(tester, fab, what: 'el botón Nueva consulta');
        // Cantidad de 4 cifras + título larguísimo: se lee entero.
        expect(find.text('9999 × $_longProduct'), findsWidgets);
        await shoot(tester, 'consultas_lista');
        // La fila de filtros se desplaza hasta el último.
        await _tap(tester, find.text('Todas (16)'));
        expectNoLayoutErrors(tester);
        await shoot(tester, 'consultas_lista_todas');
        await _toEnd(tester);
        _expectAbove(tester, find.byType(AdminCard).last, fab, reason: 'la última consulta (no la tapa el botón)');
        await shoot(tester, 'consultas_lista_final');
      });

      testWidgets('respuesta con precio de 9 cifras: resumen, mensaje larguísimo y botones en ${phone.name}', (tester) async {
        // Portapapeles (en los tests no hay plataforma).
        final copied = <String>[];
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.setData') copied.add('${(call.arguments as Map)['text']}');
          return null;
        });
        addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
        await openList(tester, phone, _smallConsultas());
        await _tap(tester, find.text('Respondidas (1)'));
        await _reveal(tester, find.text(r'Precio: $987.654.321 c/u'));
        expect(find.text(r'Total (9999 unidades): $9.875.555.555.679'), findsOneWidget);
        expect(find.textContaining('Respondió $_longName'), findsOneWidget);
        // Los dos botones del mensaje se pueden tocar cómodos.
        final copy = find.widgetWithText(OutlinedButton, 'Copiar mensaje');
        final wa = find.widgetWithText(OutlinedButton, 'WhatsApp');
        await _reveal(tester, copy);
        expect(tester.getSize(copy).height >= 43.5, isTrue, reason: '"Copiar mensaje" mide menos de 44 dp de alto');
        expect(tester.getSize(wa).height >= 43.5, isTrue, reason: '"WhatsApp" mide menos de 44 dp de alto');
        await shoot(tester, 'consultas_respuesta');

        // "Ver más" abre el mensaje entero sin desbordar.
        await _tap(tester, find.text('Ver más').last);
        expectNoLayoutErrors(tester);
        expect(find.text('Ver menos'), findsOneWidget);
        await shoot(tester, 'consultas_respuesta_entera');

        // WhatsApp con el teléfono del cliente; copiar avisa abajo.
        await _tap(tester, wa);
        expect(_launched.single, startsWith('https://wa.me/5491123456789?text='));
        await _tap(tester, copy);
        expectNoLayoutErrors(tester);
        expect(copied.single, _longMessage);
        expect(find.text('Mensaje copiado'), findsOneWidget);
        await shoot(tester, 'consultas_mensaje_copiado');
      });

      testWidgets('acciones de la tarjeta: confirmar, descartar, reabrir y eliminar en ${phone.name}', (tester) async {
        final api = FakeConsultasApi();
        await openList(tester, phone, _smallConsultas(), api: api);
        // "Confirmado" abre la hoja: el texto con nombre, producto y total
        // larguísimos se desplaza y los dos botones quedan a mano.
        await _tap(tester, find.widgetWithText(FilledButton, 'Confirmado'));
        expectNoLayoutErrors(tester);
        expect(find.byType(ConfirmOrderSheet), findsOneWidget);
        _expectSheetBelowStatusBar(tester);
        final yes = find.widgetWithText(GoldButton, 'Confirmar y crear pedido');
        final notYet = find.widgetWithText(TextButton, 'Todavía no');
        expectReachable(tester, yes, what: 'el botón Confirmar y crear pedido');
        expectReachable(tester, notYet, what: 'el botón Todavía no');
        expect(tester.getSize(notYet).height >= 43.5, isTrue, reason: '"Todavía no" mide menos de 44 dp de alto');
        expect(find.textContaining(r'por $9.875.555.555.679'), findsOneWidget);
        await shoot(tester, 'consultas_confirmar_hoja');
        await scrollToEnd(tester, scrollable: _inSheet(find.byType(Scrollable)).first);
        for (final m in ['Transferencia', 'MercadoPago', 'Efectivo']) {
          expectReachable(tester, find.widgetWithText(ChoiceChip, m), what: 'el medio de pago "$m"');
        }
        expectReachable(tester, yes, what: 'Confirmar y crear pedido con la hoja desplazada');
        await shoot(tester, 'consultas_confirmar_hoja_final');
        await tester.tap(find.widgetWithText(ChoiceChip, 'MercadoPago'));
        await settle(tester, 2);

        // El rechazo del servidor se ve en la hoja.
        api.failWith = ApiException('invalid', _longServerError);
        await tester.tap(yes);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.byType(ConfirmOrderSheet), findsOneWidget, reason: 'con error la hoja sigue abierta');
        expectReachable(tester, find.text(_longServerError), what: 'el rechazo del servidor en la hoja');
        expectReachable(tester, yes, what: 'Confirmar con el error a la vista');
        expectReachable(tester, notYet, what: 'Todavía no con el error a la vista');
        await shoot(tester, 'consultas_confirmar_error');

        api.failWith = null;
        await tester.tap(yes);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.byType(ConfirmOrderSheet), findsNothing);
        expect(api.moves.single.to, InquiryMove.confirm);
        expect(api.paidWith, 'mercadopago');
        expect(find.text('Confirmada: el pedido ya está en Pedidos'), findsOneWidget);
        await shoot(tester, 'consultas_confirmada_aviso');

        // Confirmada con pedido: lo dice entero y no ofrece reabrir.
        await _tap(tester, find.text('Confirmadas (1)'));
        expectNoLayoutErrors(tester);
        expect(find.text('Confirmada · el pedido ya está en Pedidos'), findsOneWidget);
        expect(find.text('Reabrir'), findsNothing);
        await shoot(tester, 'consultas_confirmada_con_pedido');
        await _tap(tester, find.text('No se hicieron (1)'));
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Reabrir'));
        expect(api.moves.last.to, InquiryMove.reopen);

        // Eliminar: el diálogo con el nombre larguísimo y sus acciones a mano.
        await _tap(tester, find.text('Sin responder (1)'));
        await _tap(tester, find.widgetWithText(TextButton, 'Eliminar'));
        expectNoLayoutErrors(tester);
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Eliminar')), what: 'Eliminar del diálogo');
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar del diálogo');
        await shoot(tester, 'consultas_eliminar_dialogo');
        await tester.tap(_inDialog(find.widgetWithText(TextButton, 'Eliminar')));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.deletedId, 'c1');
        expect(find.text('Consulta eliminada'), findsOneWidget);
      });

      testWidgets('estados: vacío, nada abierto, error, sin acceso y solo lectura en ${phone.name}', (tester) async {
        await openList(tester, phone, ConsultasData.fromJson({'items': <dynamic>[]}));
        expect(find.text('Todavía no hay consultas'), findsOneWidget);
        await _toEnd(tester);
        expectReachable(tester, fab, what: 'el botón Nueva consulta con la lista vacía');
        await shoot(tester, 'consultas_vacio');

        await openList(
          tester,
          phone,
          ConsultasData.fromJson({
            'items': [answeredJson('k', status: 'confirmed')],
          }),
        );
        expect(find.text('No hay consultas abiertas'), findsOneWidget);
        await _toEnd(tester);
        await shoot(tester, 'consultas_nada_abierto');

        await pumpPhone(tester, const AdminConsultasScreen(), phone: phone, me: me, overrides: [
          consultasProvider.overrideWith((ref) => throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')),
        ]);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón Reintentar');
        expect(fab, findsNothing, reason: 'sin datos no hay alta');
        await shoot(tester, 'consultas_error');

        await openList(tester, phone, _smallConsultas(), who: staffWith(['consultas'], role: 'operator', actions: const []));
        expect(find.text('Sin acceso'), findsOneWidget);
        expect(fab, findsNothing);
        await shoot(tester, 'consultas_sin_acceso');

        // Solo ver: se lee todo (y se puede copiar el mensaje), sin acciones.
        await openList(tester, phone, ConsultasData.fromJson({'items': [answeredJson('r')]}),
            who: staffWith(['consultas'], role: 'operator', actions: const ['ver']));
        expect(fab, findsNothing);
        expect(find.text('Cambiar respuesta'), findsNothing);
        expect(find.text('Confirmado'), findsNothing);
        expect(find.text('Eliminar'), findsNothing);
        expect(find.text('Copiar mensaje'), findsOneWidget);
        await _toEnd(tester);
        await shoot(tester, 'consultas_solo_lectura');
      });

      testWidgets('foto de referencia a pantalla completa en ${phone.name}', (tester) async {
        await openList(tester, phone, _smallConsultas());
        await _tap(tester, find.byType(NetImage).at(1));
        expectNoLayoutErrors(tester);
        expect(find.byType(PhotoViewerScreen), findsOneWidget);
        expect(find.text('Foto 2 de 6'), findsOneWidget);
        expectReachable(tester, find.byType(BackButton), what: 'la flecha de volver de la foto');
        await shoot(tester, 'consultas_foto_completa');
        await tester.tap(find.byType(BackButton));
        await _nav(tester);
        expect(find.byType(PhotoViewerScreen), findsNothing);
      });

      testWidgets('adjuntos de la tarjeta y hoja "Adjuntar" en ${phone.name}', (tester) async {
        final api = FakeConsultasApi();
        final files = FakeAttachmentSource([fakeFile('Audio de WhatsApp larguísimo del cliente con todos los detalles del pedido.ogg')]);
        await openList(tester, phone, _smallConsultas(), api: api, files: files, photos: FakePhotoSource());
        await _tap(tester, find.text('Sin responder (1)'));
        // Los tres adjuntos se ven y el nombre larguísimo no desborda.
        await _reveal(tester, find.text('diseño.pdf'));
        expect(find.byType(AttachmentRow), findsNWidgets(3));
        expect(tester.getSize(find.byType(AttachmentRow).first).height >= 47.5, isTrue,
            reason: 'el renglón de un adjunto mide menos de 48 dp de alto');
        await shoot(tester, 'consultas_adjuntos');
        await _tap(tester, find.text('diseño.pdf'));
        expect(_launched.single, 'https://cdn.test/consultas/c1/files/1');

        await _tap(tester, find.widgetWithText(OutlinedButton, 'Adjuntar'));
        expectNoLayoutErrors(tester);
        expect(find.byType(AttachSheet), findsOneWidget);
        _expectSheetBelowStatusBar(tester);
        for (final o in ['Foto de la galería', 'Sacar foto', 'Audio o archivo']) {
          expectReachable(tester, _inSheet(find.text(o)), what: 'la opción "$o"');
        }
        await shoot(tester, 'consultas_adjuntar_hoja');
        await tester.tap(_inSheet(find.text('Audio o archivo')));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.fileUploads.single.contentType, 'audio/ogg');
        expect(find.text('Archivo adjuntado'), findsOneWidget);
        await shoot(tester, 'consultas_adjuntado_aviso');
      });

      testWidgets('responder: teclado en el primer y el último campo, guardar y ver el mensaje en ${phone.name}', (tester) async {
        final api = FakeConsultasApi()..builtMessage = _longMessage;
        await openList(tester, phone, _smallConsultas(), api: api);
        await _tap(tester, find.widgetWithText(FilledButton, 'Responder'));
        await _nav(tester);
        expectNoLayoutErrors(tester);
        expect(find.byType(ConsultaAnswerScreen), findsOneWidget);
        expectReachable(tester, saveAnswer, what: 'el botón Guardar respuesta');
        await shoot(tester, 'consulta_responder');

        await _kbd(tester, _field(r'Precio por unidad ($)'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, saveAnswer, what: 'Guardar respuesta con el teclado (precio)');
        await fill(tester, r'Precio por unidad ($)', '987.654.321');
        expectNoLayoutErrors(tester);
        expect(find.text(r'$987.654.321 c/u · $9.875.555.555.679 por las 9999'), findsOneWidget);
        await shoot(tester, 'consulta_responder_teclado_primero');
        await closeKeyboard(tester);

        // "Por las 9999": mismo precio expresado por el total (13 cifras).
        await _tap(tester, find.widgetWithText(ChoiceChip, 'Por las 9999'));
        expectNoLayoutErrors(tester);
        expect(tester.widget<TextField>(_field(r'Precio por las 9999 ($)')).controller!.text, '9.875.555.555.679');
        await shoot(tester, 'consulta_responder_por_total');
        await _tap(tester, find.widgetWithText(ChoiceChip, 'Por unidad'));
        // La ayuda de la calculadora se lee entera (no cortada).
        await _reveal(tester, find.textContaining('Calculá el precio con la calculadora: elegís'));
        expect(
          tester.renderObject<RenderParagraph>(find.textContaining('Calculá el precio con la calculadora: elegís')).didExceedMaxLines,
          isFalse,
          reason: 'la ayuda de la calculadora se corta',
        );

        // El precio sale de la calculadora.
        await calculate(tester, 'consulta_calcular');
        await _reveal(tester, _field(r'Precio por unidad ($)'));
        expect(tester.widget<TextField>(_field(r'Precio por unidad ($)')).controller!.text, '2.900');
        expect(find.text(r'$2.900 c/u · $28.997.100 por las 9999'), findsOneWidget);
        expect(find.text('Costo guardado. Podés ajustar el precio a mano.'), findsOneWidget);
        expect(find.widgetWithText(OutlinedButton, 'Volver a calcular'), findsOneWidget);
        await shoot(tester, 'consulta_responder_calculado');

        for (final label in ['Demora', 'Precio por unidad comprando más', 'A partir de cuántas unidades', 'Medidas', 'Colores', 'Nota']) {
          await _kbd(tester, _field(label));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, saveAnswer, what: 'Guardar respuesta con el teclado ($label)');
        }
        await fill(tester, 'Nota', _longNote);
        expectNoLayoutErrors(tester);

        await _kbd(tester, _field('Mensaje para el cliente'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, saveAnswer, what: 'Guardar respuesta con el teclado (mensaje)');
        await shoot(tester, 'consulta_responder_teclado_ultimo');
        await closeKeyboard(tester);
        await _toEnd(tester);
        // La ayuda del mensaje (lo último) queda arriba del botón.
        _expectAbove(tester, find.textContaining('Se arma solo con estos datos'), saveAnswer, reason: 'la ayuda del mensaje');
        await shoot(tester, 'consulta_responder_final');

        await tester.tap(saveAnswer);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.answered!.draft.unitPrice, 2900);
        expect(api.answered!.draft.calc!.grams, 123456.75);
        expect(api.answered!.draft.calc!.printMinutes, 999 * 60 + 59);
        expect(api.answered!.draft.toJson()['unitCost'], isNull);
        expect(api.answered!.draft.message, isNull);
        // El resultado: mensaje larguísimo que se desplaza, "Listo" siempre a mano.
        expect(find.text('Respuesta guardada'), findsOneWidget);
        final done = find.widgetWithText(GoldButton, 'Listo');
        expectReachable(tester, done, what: 'el botón Listo');
        await shoot(tester, 'consulta_respuesta_guardada');
        await _toEnd(tester);
        _expectAbove(tester, find.widgetWithText(OutlinedButton, 'WhatsApp'), done, reason: 'los botones del mensaje');
        await shoot(tester, 'consulta_respuesta_guardada_final');
        await tester.tap(done);
        await _nav(tester);
        expect(find.byType(ConsultaAnswerScreen), findsNothing);
      });

      testWidgets('responder: errores, rechazo del servidor con teclado y salir con cambios en ${phone.name}', (tester) async {
        final api = FakeConsultasApi()..failWith = ApiException('invalid', _longServerError);
        await openAnswer(tester, phone, _smallConsultas().items[1], api: api);
        // Viene cargada con la respuesta anterior (datos extremos).
        expect(find.text('Cambiar respuesta'), findsOneWidget);
        await shoot(tester, 'consulta_cambiar_respuesta');

        // Borrar el "desde cuántas" deja el precio por cantidad sin su par.
        await fill(tester, 'A partir de cuántas unidades', '');
        await tester.tap(saveAnswer);
        await settle(tester);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text('Revisá los datos marcados en rojo.'), what: 'el aviso de datos por corregir');
        await _reveal(tester, find.text('Poné desde cuántas unidades.'));
        await shoot(tester, 'consulta_responder_errores');

        await _kbd(tester, _field('A partir de cuántas unidades'));
        await fill(tester, 'A partir de cuántas unidades', '50');
        await tester.tap(saveAnswer);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text(_longServerError), what: 'el rechazo del servidor (con el teclado abierto)');
        expectReachable(tester, saveAnswer, what: 'Guardar respuesta con el rechazo a la vista');
        await shoot(tester, 'consulta_responder_error_servidor');
        await closeKeyboard(tester);

        // "Atrás" (el del sistema) con cambios sin guardar pregunta antes.
        await tester.binding.handlePopRoute();
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(find.text('¿Descartar los cambios?'), findsOneWidget);
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Descartar')), what: 'Descartar');
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Seguir editando')), what: 'Seguir editando');
        await shoot(tester, 'consulta_responder_descartar');
        await tester.tap(_inDialog(find.text('Seguir editando')));
        await settle(tester);
        expect(find.byType(ConsultaAnswerScreen), findsOneWidget);
      });

      testWidgets('nueva consulta: teclado en cada campo, fotos y guardar en ${phone.name}', (tester) async {
        final api = FakeConsultasApi();
        final source = FakePhotoSource(gallery: [for (var i = 0; i < 6; i++) fakePhoto('ref_$i.jpg')]);
        final files = FakeAttachmentSource([
          fakeFile('Audio de WhatsApp larguísimo del cliente con todos los detalles del pedido.ogg'),
          for (var i = 0; i < 9; i++) fakeFile('archivo_$i.pdf', size: 3 * 1024 * 1024),
        ]);
        await openList(tester, phone, _smallConsultas(), api: api, photos: source, files: files);
        await tester.tap(fab);
        await _nav(tester);
        expectNoLayoutErrors(tester);
        expect(find.byType(ConsultaFormScreen), findsOneWidget);
        expectReachable(tester, saveNew, what: 'el botón Cargar consulta');
        await shoot(tester, 'consulta_alta');

        await _kbd(tester, _field('Nombre del cliente'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, saveNew, what: 'Cargar consulta con el teclado (nombre)');
        await fill(tester, 'Nombre del cliente', _longName);
        await shoot(tester, 'consulta_alta_teclado_primero');
        for (final label in ['WhatsApp (opcional)', 'Qué pide', 'Cantidad', 'Detalles (opcional)']) {
          await _kbd(tester, _field(label));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, saveNew, what: 'Cargar consulta con el teclado ($label)');
        }
        await shoot(tester, 'consulta_alta_teclado_ultimo');
        await fill(tester, 'Detalles (opcional)', _longNote);
        expectNoLayoutErrors(tester);
        await fill(tester, 'Qué pide', _longProduct);
        await fill(tester, 'Cantidad', '9999');
        await closeKeyboard(tester);

        await _tap(tester, find.widgetWithText(OutlinedButton, 'Sumar fotos'));
        expectNoLayoutErrors(tester);
        expect(find.byTooltip('Quitar foto'), findsNWidgets(6));
        await shoot(tester, 'consulta_alta_fotos');

        // Audios y archivos: entran ocho de los diez y lo dice.
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Sumar audio o archivo'));
        expectNoLayoutErrors(tester);
        await _toEnd(tester);
        expect(find.text('Llegaste al tope de 8 archivos.'), findsOneWidget);
        expect(find.textContaining('quedaron 2 afuera'), findsOneWidget);
        expectReachable(tester, saveNew, what: 'Cargar consulta al final del formulario');
        _expectAbove(tester, find.byTooltip('Quitar archivo').last, saveNew, reason: 'el último archivo');
        expect(tester.getSize(find.widgetWithIcon(IconButton, Icons.close_rounded).last).height >= 43.5, isTrue,
            reason: 'la cruz de quitar un archivo mide menos de 44 dp');
        await shoot(tester, 'consulta_alta_archivos');

        await tester.tap(saveNew);
        await settle(tester, 12);
        expectNoLayoutErrors(tester);
        expect(api.created!.quantity, 9999);
        expect(api.uploads, hasLength(6));
        expect(api.fileUploads, hasLength(8));
        expect(find.byType(ConsultaFormScreen), findsNothing);
        expect(find.text('Consulta cargada'), findsOneWidget);
        await shoot(tester, 'consulta_cargada_aviso');
      });

      testWidgets('nueva consulta: errores, rechazo del servidor y salir con datos en ${phone.name}', (tester) async {
        final api = FakeConsultasApi()..failWith = ApiException('invalid', _longServerError);
        await pumpPhone(tester, const ConsultaFormScreen(maxImages: 6),
            phone: phone, me: me, overrides: ov(_smallConsultas(), api, FakePhotoSource()));
        await tester.tap(saveNew);
        await settle(tester);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text('Revisá los datos marcados en rojo.'), what: 'el aviso de datos por corregir');
        await shoot(tester, 'consulta_alta_errores');

        await fill(tester, 'Nombre del cliente', 'Carla');
        await fill(tester, 'Qué pide', 'Llavero');
        await _kbd(tester, _field('Detalles (opcional)'));
        await tester.tap(saveNew);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text(_longServerError), what: 'el rechazo del servidor (con el teclado abierto)');
        expectReachable(tester, saveNew, what: 'Cargar consulta con el rechazo a la vista');
        await shoot(tester, 'consulta_alta_error_servidor');
        await closeKeyboard(tester);

        // "Atrás" (el del sistema) con datos cargados pregunta antes de perderlos.
        await tester.binding.handlePopRoute();
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(find.text('¿Descartar los cambios?'), findsOneWidget);
        expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Descartar')), what: 'Descartar');
        await shoot(tester, 'consulta_alta_descartar');
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico: listado, respuesta, formularios y diálogo', (tester) async {
      await openList(tester, Phone.small, _bigConsultas(), textScale: 1.3);
      await shoot(tester, 'consultas_lista_grande');
      await _tap(tester, find.text('Todas (16)'));
      expectNoLayoutErrors(tester);
      await _toEnd(tester);
      _expectAbove(tester, find.byType(AdminCard).last, fab, reason: 'la última consulta con letra grande');
      await shoot(tester, 'consultas_lista_grande_final');

      final api = FakeConsultasApi()..builtMessage = _longMessage;
      await openList(tester, Phone.small, _smallConsultas(), api: api, textScale: 1.3);
      await _reveal(tester, find.widgetWithText(OutlinedButton, 'WhatsApp'));
      await shoot(tester, 'consultas_respuesta_grande');
      await _tap(tester, find.text('Respondidas (1)'));
      await _tap(tester, find.widgetWithText(FilledButton, 'Confirmado'));
      expectNoLayoutErrors(tester);
      _expectSheetBelowStatusBar(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar y crear pedido'), what: 'Confirmar y crear pedido con letra grande');
      expectReachable(tester, find.widgetWithText(TextButton, 'Todavía no'), what: 'Todavía no con letra grande');
      await shoot(tester, 'consultas_confirmar_hoja_grande');
      await scrollToEnd(tester, scrollable: _inSheet(find.byType(Scrollable)).first);
      expectReachable(tester, find.widgetWithText(ChoiceChip, 'Efectivo'), what: 'Efectivo con letra grande');
      await shoot(tester, 'consultas_confirmar_hoja_grande_final');
      await tester.tap(find.widgetWithText(TextButton, 'Todavía no'));
      await settle(tester, 8);
      expect(find.byType(ConfirmOrderSheet), findsNothing);

      await _tap(tester, find.text('Sin responder (1)'));
      await _reveal(tester, find.text('diseño.pdf'));
      await shoot(tester, 'consultas_adjuntos_grande');
      await _tap(tester, find.widgetWithText(OutlinedButton, 'Adjuntar'));
      expectNoLayoutErrors(tester);
      _expectSheetBelowStatusBar(tester);
      expectReachable(tester, _inSheet(find.text('Audio o archivo')), what: 'Audio o archivo con letra grande');
      await shoot(tester, 'consultas_adjuntar_hoja_grande');
      await tester.tapAt(const Offset(180, 30));
      await settle(tester, 8);

      await _tap(tester, find.widgetWithText(TextButton, 'Eliminar'));
      expectNoLayoutErrors(tester);
      expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Eliminar')), what: 'Eliminar del diálogo con letra grande');
      expectReachable(tester, _inDialog(find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar del diálogo con letra grande');
      await shoot(tester, 'consultas_eliminar_dialogo_grande');

      await openAnswer(tester, Phone.small, _smallConsultas().items[1], api: api, textScale: 1.3);
      await shoot(tester, 'consulta_responder_grande');
      // La calculadora con letra grande: en modo total y con el teclado.
      await _tap(tester, find.widgetWithText(ChoiceChip, 'Por las 9999'));
      expectNoLayoutErrors(tester);
      await calculate(tester, 'consulta_calcular_grande');
      await _reveal(tester, _field(r'Precio por las 9999 ($)'));
      expect(tester.widget<TextField>(_field(r'Precio por las 9999 ($)')).controller!.text, '28.997.100');
      await shoot(tester, 'consulta_responder_grande_calculado');
      await _kbd(tester, _field('Precio por unidad comprando más'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, saveAnswer, what: 'Guardar respuesta con letra grande y teclado');
      await shoot(tester, 'consulta_responder_grande_teclado');
      await closeKeyboard(tester);
      await _toEnd(tester);
      await shoot(tester, 'consulta_responder_grande_final');
      await tester.tap(saveAnswer);
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Listo'), what: 'Listo con letra grande');
      await _toEnd(tester);
      await shoot(tester, 'consulta_respuesta_guardada_grande');

      final source = FakePhotoSource(gallery: [for (var i = 0; i < 6; i++) fakePhoto('ref_$i.jpg')]);
      await pumpPhone(tester, const ConsultaFormScreen(maxImages: 6),
          phone: Phone.small,
          textScale: 1.3,
          me: me,
          overrides: ov(_smallConsultas(), FakeConsultasApi(), source, FakeAttachmentSource()));
      await shoot(tester, 'consulta_alta_grande');
      await _kbd(tester, _field('WhatsApp (opcional)'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, saveNew, what: 'Cargar consulta con letra grande y teclado');
      await closeKeyboard(tester);
      await _tap(tester, find.widgetWithText(OutlinedButton, 'Sumar fotos'));
      expectNoLayoutErrors(tester);
      await _tap(tester, find.widgetWithText(OutlinedButton, 'Sumar audio o archivo'));
      expectNoLayoutErrors(tester);
      await _toEnd(tester);
      expectReachable(tester, saveNew, what: 'Cargar consulta al final con letra grande');
      await shoot(tester, 'consulta_alta_grande_fotos');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: listado, respuesta y formularios', (tester) async {
        await openList(tester, Phone.small, _smallConsultas(), theme: mode);
        await shoot(tester, 'consultas_lista_${mode.name}');
        await _reveal(tester, find.widgetWithText(OutlinedButton, 'WhatsApp'));
        await shoot(tester, 'consultas_respuesta_${mode.name}');
        await openAnswer(tester, Phone.small, _smallConsultas().items[1], theme: mode);
        await shoot(tester, 'consulta_responder_${mode.name}');
        await pumpPhone(tester, const ConsultaFormScreen(maxImages: 6),
            phone: Phone.small, theme: mode, me: me, overrides: ov(_smallConsultas(), FakeConsultasApi(), FakePhotoSource()));
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Sumar fotos'));
        await _toEnd(tester);
        await shoot(tester, 'consulta_alta_${mode.name}');
      });
    }
  });
}

/// Contraste WCAG entre dos colores opacos (1 = iguales, 21 = negro/blanco).
double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}
