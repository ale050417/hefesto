// JSON de ejemplo con la forma REAL de los endpoints de Clientes, Descuentos y
// Recompensas (ver src/features/*/admin-api.ts), para los tests de modelos y
// de pantallas.

const idJuan = '11111111-1111-4111-8111-111111111111';
const idFeria = '22222222-2222-4222-8222-222222222222';
const idAna = '33333333-3333-4333-8333-333333333333';

/// GET /api/v1/admin/clientes
Map<String, dynamic> sampleCustomersJson() => {
      'items': [
        {
          'id': idJuan,
          'source': 'registered',
          'name': 'Juan Pérez',
          'email': 'juan@mail.com',
          'phone': '+54 3757 62-4148',
          'city': 'Posadas',
          'note': 'Le gusta el rojo oscuro',
          'since': '2026-03-01T12:00:00.000Z',
          'orders': 4,
          'spent': 87500.5,
          'tier': 'silver',
          'tierLabel': 'Frecuente',
        },
        {
          'id': idFeria,
          'source': 'manual',
          'name': 'Cliente de feria con un nombre bastante largo para probar el recorte en pantallas chicas',
          'email': null,
          'phone': '011 5555-1234',
          'city': null,
          'note': null,
          'since': '2026-09-10T09:00:00.000Z',
          'orders': 0,
          'spent': 0,
          'tier': 'bronze',
          'tierLabel': 'Nuevo',
        },
        {
          'id': idAna,
          'source': 'registered',
          'name': 'Ana Gómez',
          'email': 'ana@mail.com',
          'phone': null,
          'city': 'Oberá',
          'note': null,
          'since': '2025-12-01T00:00:00.000Z',
          'orders': 12,
          'spent': '2300000', // numeric de Postgres como String
          'tier': 'gold',
          'tierLabel': 'VIP',
        },
      ],
      'total': 3,
      'counts': {'all': 3, 'gold': 1, 'silver': 1, 'bronze': 1},
      'totalSpent': 2387500.5,
      'tiers': {
        'gold': {'label': 'VIP', 'minSpent': 150000, 'minOrders': 10},
        'silver': {'label': 'Frecuente', 'minSpent': 40000, 'minOrders': 3},
        'bronze': {'label': 'Nuevo', 'minSpent': 0, 'minOrders': 0},
      },
    };

/// GET /api/v1/admin/clientes/:id de un cliente registrado con pedidos y canjes.
Map<String, dynamic> sampleCustomerDetailJson() => {
      'customer': (sampleCustomersJson()['items'] as List)[0],
      'orders': [
        {
          'id': 'o1',
          'orderNumber': 'HF-0042',
          'status': 'in_production',
          'total': 57500,
          'createdAt': '2026-10-28T10:00:00.000Z',
        },
        {
          'id': 'o2',
          'orderNumber': 'HF-0031',
          'status': 'delivered',
          'total': 30000.5,
          'createdAt': '2026-09-02T10:00:00.000Z',
        },
      ],
      'points': {
        'balance': 120,
        'earned': 200,
        'redeemed': 80,
        'redemptions': [
          {
            'id': 'p1',
            'reason': 'Canje: \$2.000 de descuento · cupón PREMIO-AB12C',
            'points': 80,
            'createdAt': '2026-10-02T10:00:00.000Z',
          },
        ],
      },
    };

/// GET /api/v1/admin/clientes/:id de un cliente manual.
Map<String, dynamic> sampleManualDetailJson() => {
      'customer': (sampleCustomersJson()['items'] as List)[1],
      'orders': <dynamic>[],
      'points': {'balance': 0, 'earned': 0, 'redeemed': 0, 'redemptions': <dynamic>[]},
    };

/// GET /api/v1/admin/descuentos
Map<String, dynamic> sampleCouponsJson() => {
      'items': [
        {
          'id': 'k1',
          'code': 'HEFESTO15',
          'description': '15% en toda la tienda',
          'type': 'percentage',
          'value': 15,
          'minPurchase': 0,
          'scope': 'all',
          'targetId': null,
          'targetLabel': null,
          'birthdayOnly': false,
          'maxUses': 100,
          'usedCount': 37,
          'startsAt': null,
          'expiresAt': '2026-12-31T00:00:00.000Z',
          'isActive': true,
          'status': 'active',
          'createdAt': '2026-10-01T00:00:00.000Z',
        },
        {
          'id': 'k2',
          'code': 'MATE2000',
          'description': r'$2.000 en mates, con una descripción larga que tiene que cortarse sola en dos renglones',
          'type': 'fixed',
          'value': '2000.00',
          'minPurchase': '15000.00',
          'scope': 'category',
          'targetId': 'c1',
          'targetLabel': 'Mates personalizados',
          'birthdayOnly': false,
          'maxUses': null,
          'usedCount': 5,
          'startsAt': null,
          'expiresAt': null,
          'isActive': false,
          'status': 'paused',
          'createdAt': '2026-09-01T00:00:00.000Z',
        },
        {
          'id': 'k3',
          'code': 'CUMPLE10',
          'description': null,
          'type': 'percentage',
          'value': 10,
          'minPurchase': 0,
          'scope': 'all',
          'targetId': null,
          'targetLabel': null,
          'birthdayOnly': true,
          'maxUses': 50,
          'usedCount': 50,
          'startsAt': null,
          'expiresAt': '2026-06-30T00:00:00.000Z',
          'isActive': true,
          'status': 'expired',
          'createdAt': '2026-05-01T00:00:00.000Z',
        },
        {
          'id': 'k4',
          'code': 'PREMIO-AB12C',
          'description': 'Premio de fidelidad: \$2.000 de descuento',
          'type': 'fixed',
          'value': 2000,
          'minPurchase': 0,
          'scope': 'all',
          'targetId': null,
          'targetLabel': null,
          'birthdayOnly': false,
          'maxUses': 1,
          'usedCount': 0,
          'startsAt': null,
          'expiresAt': null,
          'isActive': true,
          'status': 'active',
          'createdAt': '2026-10-20T00:00:00.000Z',
        },
      ],
      'counts': {'total': 4, 'active': 2, 'paused': 1, 'expired': 1, 'uses': 92},
    };

/// GET /api/v1/admin/descuentos/opciones
Map<String, dynamic> sampleCouponOptionsJson() => {
      'products': [
        {'id': 'p1', 'name': 'Mate Mario'},
        {'id': 'p2', 'name': 'Cartel Personalizado'},
        {'id': 'p3', 'name': 'Tony Tony Chopper Tamaño Real'},
      ],
      'categories': [
        {'id': 'c1', 'name': 'Mates personalizados'},
        {'id': 'c2', 'name': 'Carteles'},
      ],
    };

/// GET /api/v1/admin/recompensas
Map<String, dynamic> sampleRewardsJson() => {
      'program': {'pointsPerAmount': 100, 'moneyPerPoint': 1},
      'stats': {'inCirculation': 18450, 'redemptions': 23, 'pointsRedeemed': 9800},
      'rewards': [
        {
          'id': 'r1',
          'type': 'shipping',
          'typeLabel': 'Envío gratis',
          'title': 'Envío gratis',
          'description': 'En tu próximo pedido, a todo el país',
          'costPoints': 300,
          'discountValue': null,
          'discountIsPercent': false,
          'productId': null,
          'productName': null,
          'isActive': true,
          'createdAt': '2026-09-01T10:00:00.000Z',
        },
        {
          'id': 'r2',
          'type': 'discount',
          'typeLabel': 'Descuento',
          'title': r'$2.000 de descuento',
          'description': null,
          'costPoints': 500,
          'discountValue': 2000,
          'discountIsPercent': false,
          'productId': null,
          'productName': null,
          'isActive': true,
          'createdAt': '2026-09-02T10:00:00.000Z',
        },
        {
          'id': 'r3',
          'type': 'discount',
          'typeLabel': 'Descuento',
          'title': '15% de descuento en toda la tienda, sin tope de compra',
          'description': 'Cupón aplicable a cualquier pedido',
          'costPoints': 1500,
          'discountValue': '15.00',
          'discountIsPercent': true,
          'productId': null,
          'productName': null,
          'isActive': false,
          'createdAt': '2026-09-03T10:00:00.000Z',
        },
        {
          'id': 'r4',
          'type': 'product',
          'typeLabel': 'Producto gratis',
          'title': 'Llavero de regalo',
          'description': null,
          'costPoints': 2500,
          'discountValue': null,
          'discountIsPercent': false,
          'productId': 'p9',
          'productName': 'Llavero Hefesto',
          'isActive': true,
          'createdAt': '2026-09-04T10:00:00.000Z',
        },
      ],
      'products': [
        {'id': 'p9', 'name': 'Llavero Hefesto'},
        {'id': 'p1', 'name': 'Mate Mario'},
      ],
      'recentRedemptions': [
        {
          'id': 't1',
          'customerId': idJuan,
          'customerName': 'Juan Pérez',
          'reason': 'Canje: \$2.000 de descuento · cupón PREMIO-AB12C',
          'points': 500,
          'createdAt': '2026-10-30T15:00:00.000Z',
        },
        {
          'id': 't2',
          'customerId': idAna,
          'customerName': null,
          'reason': 'Canje: Envío gratis',
          'points': 300,
          'createdAt': '2026-10-29T12:30:00.000Z',
        },
      ],
    };
