import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_models.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_providers.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'admin_crecimiento_samples.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es_AR'));

  group('RewardsPage', () {
    test('parsea reglas, estadísticas, catálogo, productos y canjes', () {
      final p = RewardsPage.fromJson(sampleRewardsJson());
      expect(p.program.pointsPerAmount, 100);
      expect(p.program.moneyPerPoint, 1);
      expect(p.stats.inCirculation, 18450);
      expect(p.stats.redemptions, 23);
      expect(p.stats.pointsRedeemed, 9800);
      expect(p.rewards, hasLength(4));
      expect(p.products.map((x) => x.name), ['Llavero Hefesto', 'Mate Mario']);
      expect(p.recentRedemptions, hasLength(2));
      expect(p.recentRedemptions[0].customerName, 'Juan Pérez');
      expect(p.recentRedemptions[1].customerName, isNull);
      expect(p.recentRedemptions[0].points, 500);
    });

    test('tipos, numeric como String y estado pausado', () {
      final r = RewardsPage.fromJson(sampleRewardsJson()).rewards;
      expect(r[0].type, RewardType.shipping);
      expect(r[0].benefitLabel, 'Envío gratis en su próximo pedido');
      expect(r[1].benefitLabel, r'$2.000 de descuento');
      expect(r[2].discountValue, 15, reason: 'llegó como "15.00"');
      expect(r[2].discountIsPercent, isTrue);
      expect(r[2].benefitLabel, '15% de descuento');
      expect(r[2].isActive, isFalse);
      expect(r[3].type, RewardType.product);
      expect(r[3].benefitLabel, 'Llavero Hefesto');
      expect(r[3].productId, 'p9');
    });

    test('tolera una respuesta mínima o rara sin lanzar', () {
      final p = RewardsPage.fromJson({
        'rewards': [
          {'id': 'x', 'type': 'inventado', 'title': null, 'costPoints': '300', 'discountValue': 'no-es-numero'},
          {'id': 'y', 'type': 'product', 'costPoints': null},
        ],
        'program': {'pointsPerAmount': 0},
      });
      expect(p.rewards[0].type, RewardType.discount);
      expect(p.rewards[0].title, 'Recompensa');
      expect(p.rewards[0].costPoints, 300);
      expect(p.rewards[0].discountValue, 0);
      expect(p.rewards[1].benefitLabel, 'Producto de regalo');
      expect(p.rewards[1].costPoints, 0);
      expect(p.program.pointsPerAmount, 100, reason: 'regla inválida cae al valor del servidor');
      expect(p.stats.inCirculation, 0);
      expect(p.products, isEmpty);
      expect(RewardsPage.fromJson({}).rewards, isEmpty);
    });
  });

  group('cuerpo de crear / editar', () {
    test('descuento fijo: lleva valor y no lleva producto', () {
      final b = rewardBody(
        type: RewardType.discount,
        title: '  \$2.000 de descuento ',
        description: '',
        costPoints: 500,
        discountValue: 2000,
        discountIsPercent: false,
        productId: 'p1',
        isActive: true,
      );
      expect(b['type'], 'discount');
      expect(b['title'], r'$2.000 de descuento');
      expect(b['discountValue'], 2000);
      expect(b['discountIsPercent'], isFalse);
      expect(b['productId'], isNull);
      expect(b['costPoints'], 500);
    });

    test('envío gratis no manda valor ni producto aunque el formulario los tenga', () {
      final b = rewardBody(
        type: RewardType.shipping,
        title: 'Envío gratis',
        description: 'A todo el país',
        costPoints: 300,
        discountValue: 15,
        discountIsPercent: true,
        productId: 'p1',
        isActive: false,
      );
      expect(b['discountValue'], isNull);
      expect(b['discountIsPercent'], isFalse);
      expect(b['productId'], isNull);
      expect(b['isActive'], isFalse);
    });

    test('regalo de producto lleva el producto', () {
      final b = rewardBody(
        type: RewardType.product,
        title: 'Llavero',
        description: '',
        costPoints: 2500,
        discountValue: null,
        discountIsPercent: false,
        productId: 'p9',
        isActive: true,
      );
      expect(b['productId'], 'p9');
      expect(b['discountValue'], isNull);
    });

    test('pausar/activar reenvía la recompensa tal cual con otro estado', () {
      final r = RewardsPage.fromJson(sampleRewardsJson()).rewards[2];
      final b = rewardBodyWithActive(r, true);
      expect(b['isActive'], isTrue);
      expect(b['type'], 'discount');
      expect(b['discountValue'], 15);
      expect(b['discountIsPercent'], isTrue);
      expect(b['title'], r.title);
      expect(b['costPoints'], 1500);
      expect(b['description'], 'Cupón aplicable a cualquier pedido');
    });
  });
}
