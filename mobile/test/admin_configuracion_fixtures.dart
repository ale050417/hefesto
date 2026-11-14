// Datos de ejemplo de Configuración (compartidos por los tests de modelos y pantallas).

// JSON con la forma real de `GET /api/v1/admin/configuracion` (ver
// src/features/settings/api-serialize.ts) y de `/equipo`.
Map<String, dynamic> configJson() => {
      'negocio': {
        'storeName': 'Hefesto 3D',
        'slogan': 'Forjado en capas',
        'description': '',
        'whatsapp': '+54 3757 624148',
        'contactEmail': 'hola@hefesto3d.com',
        'addressText': 'Av. Victoria Aguirre 320',
        'instagram': '@hefesto3d',
        'tiktok': '@hefesto.tiktok',
        'cuit': '',
        'hours': [
          {
            'label': 'Lun a Vie',
            'morning': {'on': true, 'from': '09:00', 'to': '13:00'},
            'afternoon': {'on': true, 'from': '16:00', 'to': '20:00'},
          },
          {
            'label': 'Sábados',
            'morning': {'on': true, 'from': '09:00', 'to': '13:00'},
            'afternoon': {'on': false, 'from': '', 'to': ''},
          },
          {
            'label': 'Domingos',
            'morning': {'on': false, 'from': '', 'to': ''},
            'afternoon': {'on': false, 'from': '', 'to': ''},
          },
        ],
      },
      'envios': {
        'city': 'Iguazú',
        'freeOver': 30000,
        'outMsg': '',
        'zones': [
          {'name': 'Centro', 'price': 1500},
          {'name': 'Km 5', 'price': '2000.50'},
        ],
        'pickupEnabled': true,
        'deliveryEnabled': false,
      },
      'pagos': {
        'transferEnabled': true,
        'transferAlias': 'hefesto.3d',
        'transferCbu': '0000003100012345678901',
        'mpEnabled': true,
        'mpNote': '',
        'mpConnected': false,
        'cashEnabled': false,
        'cashNote': 'Solo retiro',
      },
      'tienda': {
        'businessMode': 'checkout',
        'accentColor': '#C9A84C',
        'season': 'navidad',
        'seasonDeco': true,
        'seasonIntensity': 16,
        'seasonDurationSec': 10,
        'bannerIntervalSec': 7,
        'logoUrl': null,
        'heroImageUrl': null,
        'homeSections': [
          {'id': 'trustBar', 'label': 'Banda de confianza', 'on': true},
          {'id': 'faq', 'label': 'Preguntas frecuentes', 'on': false},
        ],
        'seasons': [
          {'key': 'none', 'label': 'Marca Hefesto', 'hint': 'Tu identidad dorada de siempre', 'accent': '#C9A84C', 'hasDeco': false},
          {'key': 'navidad', 'label': 'Navidad', 'hint': 'Rojo y verde + nieve cayendo', 'accent': '#D7263D', 'hasDeco': true},
          {'key': 'halloween', 'label': 'Halloween', 'hint': 'Naranja calabaza', 'accent': '#E8741E', 'hasDeco': true},
        ],
        'banners': [
          {
            'id': 'b1',
            'title': 'Figuras de colección',
            'subtitle': null,
            'imageUrl': null, // (sin red en los tests: se ve el marcador de posición)
            'position': '78% 0%',
            'align': 'left',
            'ctaText': 'Ver productos',
            'ctaHref': '/productos',
            'isActive': true,
            'sortOrder': 0,
          },
          {'id': 'b2', 'title': 'Promo de verano', 'imageUrl': null, 'position': '50% 50%', 'align': 'center', 'isActive': false, 'sortOrder': 1},
        ],
      },
      'textos': {
        'trustBar': [
          {'ic': 'truck', 't': 'Producción en 48 h', 'd': 'Imprimimos y despachamos rápido'},
          {'ic': 'shield', 't': 'Pago 100% seguro', 'd': 'MercadoPago, transferencia y efectivo'},
        ],
        'trustBarCustom': false,
        'faq': [
          {'q': '¿Cuánto tarda mi pedido?', 'a': 'Depende de la pieza.'},
        ],
        'faqCustom': true,
        'quote': {
          'title': 'COTIZACIÓN — HEFESTO 3D',
          'depositPct': 50,
          'depositText': 'La seña es necesaria.',
          'notes': ['Las dimensiones pueden variar.'],
        },
      },
    };

Map<String, dynamic> teamJson() => {
      'canManage': true,
      'team': [
        {'id': 'u1', 'fullName': 'Ale', 'email': 'ale@x.com', 'role': 'admin', 'roleId': 'r1', 'roleName': 'Administrador', 'status': 'activo', 'isSelf': true, 'isLastAdmin': true},
        {'id': 'u2', 'fullName': null, 'email': 'anto@x.com', 'role': 'operator', 'roleId': 'r2', 'roleName': 'Operador', 'status': 'invitado', 'isSelf': false, 'isLastAdmin': false},
        {'id': 'u3', 'fullName': 'Sin rol', 'email': null, 'role': 'operator', 'roleId': null, 'roleName': null, 'status': 'activo', 'isSelf': false, 'isLastAdmin': false},
      ],
      'roles': [
        {'id': 'r1', 'name': 'Administrador', 'isSystem': true, 'isAdmin': true, 'permissions': <String, dynamic>{}, 'memberCount': 1},
        {
          'id': 'r2',
          'name': 'Operador',
          'isSystem': true,
          'isAdmin': false,
          'permissions': {
            'pedidos': ['ver', 'editar'],
            'productos': ['ver'],
            'config': <String>[],
          },
          'memberCount': 1,
        },
      ],
      'modules': [
        {'key': 'pedidos', 'label': 'Pedidos'},
        {'key': 'productos', 'label': 'Productos y categorías'},
        {'key': 'config', 'label': 'Configuración'},
        {'key': 'auditoria', 'label': 'Auditoría'},
      ],
    };

