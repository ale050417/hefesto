import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/crecimiento/form_kit.dart';
import 'package:hefesto/features/admin/descuentos/descuentos_models.dart';
import 'package:hefesto/features/admin/descuentos/descuentos_providers.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'admin_crecimiento_samples.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es_AR'));

  group('CouponsPage', () {
    test('parsea cupones, estados y contadores', () {
      final page = CouponsPage.fromJson(sampleCouponsJson());
      expect(page.items, hasLength(4));
      expect(page.counts.total, 4);
      expect(page.counts.of(CouponStatus.active), 2);
      expect(page.counts.of(CouponStatus.paused), 1);
      expect(page.counts.of(CouponStatus.expired), 1);
      expect(page.counts.of(null), 4);
      expect(page.counts.uses, 92);
      expect(page.items.map((c) => c.status), [
        CouponStatus.active,
        CouponStatus.paused,
        CouponStatus.expired,
        CouponStatus.active,
      ]);
    });

    test('numeric como String, scope y topes', () {
      final c = CouponsPage.fromJson(sampleCouponsJson()).items[1];
      expect(c.isPercent, isFalse);
      expect(c.value, 2000);
      expect(c.minPurchase, 15000);
      expect(c.scope, CouponScope.category);
      expect(c.scopeLabel, 'Mates personalizados');
      expect(c.maxUses, isNull);
      expect(c.usage, 0, reason: 'sin tope no hay barra de uso');
      expect(c.isActive, isFalse);
      expect(c.valueLabel, r'$2.000');
    });

    test('porcentaje, uso consumido y cupones de premio', () {
      final items = CouponsPage.fromJson(sampleCouponsJson()).items;
      expect(items[0].valueLabel, '15%');
      expect(items[0].usage, closeTo(0.37, 1e-9));
      expect(items[2].usage, 1, reason: 'agotado: 50 de 50');
      expect(items[2].birthdayOnly, isTrue);
      expect(items[3].isRewardCoupon, isTrue);
      expect(items[0].isRewardCoupon, isFalse);
      expect(items[0].scopeLabel, 'Toda la compra');
    });

    test('el vencimiento se conserva como día UTC (igual que la web)', () {
      final c = CouponsPage.fromJson(sampleCouponsJson()).items[0];
      expect(c.expiresAt!.isUtc, isTrue);
      expect(formatExpiry(c.expiresAt!), '31 dic 2026');
      expect(isoDay(c.expiresAt!), '2026-12-31');
      expect(c.startsAt, isNull);
    });

    test('tolera una respuesta mínima o rara sin lanzar', () {
      final page = CouponsPage.fromJson({
        'items': [
          {'id': 'x', 'code': null, 'type': 'raro', 'value': null, 'status': 'inventado', 'usedCount': '3', 'maxUses': 'no'},
        ],
      });
      final c = page.items.single;
      expect(c.code, '—');
      expect(c.isPercent, isFalse);
      expect(c.value, 0);
      expect(c.status, CouponStatus.active);
      expect(c.usedCount, 3);
      expect(c.maxUses, 0, reason: 'un maxUses ilegible no rompe la pantalla');
      expect(c.usage, 0);
      expect(page.counts.total, 1);
      expect(CouponsPage.fromJson({}).items, isEmpty);
    });
  });

  group('búsqueda y link', () {
    final items = CouponsPage.fromJson(sampleCouponsJson()).items;
    test('por código, descripción o producto/categoría', () {
      expect(items.where((c) => c.matches('hefesto')).map((c) => c.code), ['HEFESTO15']);
      expect(items.where((c) => c.matches('en mates')).map((c) => c.code), ['MATE2000']);
      expect(items.where((c) => c.matches('personalizados')).map((c) => c.code), ['MATE2000']);
      expect(items.where((c) => c.matches('  ')), hasLength(4));
    });

    test('link directo a la tienda con el cupón aplicado', () {
      expect(items[0].shareLink('https://hefesto3d.com.ar'), 'https://hefesto3d.com.ar/catalogo?cupon=HEFESTO15');
      expect(items[3].shareLink('https://x.com'), 'https://x.com/catalogo?cupon=PREMIO-AB12C');
    });
  });

  group('CouponOptions', () {
    test('productos y categorías', () {
      final o = CouponOptions.fromJson(sampleCouponOptionsJson());
      expect(o.products.map((p) => p.name), ['Mate Mario', 'Cartel Personalizado', 'Tony Tony Chopper Tamaño Real']);
      expect(o.categories.map((c) => c.id), ['c1', 'c2']);
      expect(CouponOptions.fromJson({}).products, isEmpty);
    });
  });

  group('cuerpo de crear / editar', () {
    test('un cupón por porcentaje a todo el carrito', () {
      final body = couponBody(
        code: ' hefesto15 ',
        description: ' 15% en toda la tienda ',
        isPercent: true,
        value: 15,
        minPurchase: 0,
        maxUses: null,
        startsAt: null,
        expiresAt: DateTime.utc(2026, 12, 31),
        isActive: true,
        scope: CouponScope.all,
        targetId: 'p1',
        targetLabel: 'Mate Mario',
        birthdayOnly: false,
      );
      expect(body['code'], 'HEFESTO15');
      expect(body['description'], '15% en toda la tienda');
      expect(body['type'], 'percentage');
      expect(body['expiresAt'], '2026-12-31', reason: 'solo el día, como la web');
      expect(body['maxUses'], isNull);
      expect(body['startsAt'], isNull);
      expect(body['scope'], 'all');
      expect(body['targetId'], isNull, reason: 'a todo el carrito no lleva objetivo aunque haya uno elegido');
      expect(body['targetLabel'], isNull);
    });

    test('un cupón fijo a una categoría, sin vencimiento, conserva el inicio', () {
      final start = DateTime.utc(2026, 11, 1, 3);
      final body = couponBody(
        code: 'mates',
        description: '',
        isPercent: false,
        value: 2000,
        minPurchase: 15000,
        maxUses: 20,
        startsAt: start,
        expiresAt: null,
        isActive: false,
        scope: CouponScope.category,
        targetId: 'c1',
        targetLabel: 'Mates personalizados',
        birthdayOnly: true,
      );
      expect(body['type'], 'fixed');
      expect(body['expiresAt'], '', reason: 'vacío = sin vencimiento');
      expect(body['startsAt'], '2026-11-01T03:00:00.000Z');
      expect(body['scope'], 'category');
      expect(body['targetId'], 'c1');
      expect(body['maxUses'], 20);
      expect(body['minPurchase'], 15000);
      expect(body['isActive'], isFalse);
      expect(body['birthdayOnly'], isTrue);
    });
  });

  group('parseAmount (números tipeados a la argentina)', () {
    test('miles con punto, decimales con coma o punto', () {
      expect(parseAmount('2000'), 2000);
      expect(parseAmount('2.000'), 2000);
      expect(parseAmount('1.500,50'), 1500.5);
      expect(parseAmount('15,5'), 15.5);
      expect(parseAmount('15.5'), 15.5);
      expect(parseAmount(r' $ 2.000 '), 2000);
      expect(parseAmount('1.234.567'), 1234567);
    });
    test('vacío o ilegible es null', () {
      expect(parseAmount(''), isNull);
      expect(parseAmount('  '), isNull);
      expect(parseAmount('abc'), isNull);
      expect(parseAmount('1,2,3'), isNull);
    });
    test('plainNumber no deja ceros de más', () {
      expect(plainNumber(2000.0), '2000');
      expect(plainNumber(15.5), '15,5');
      expect(plainNumber(15), '15');
    });
  });
}
