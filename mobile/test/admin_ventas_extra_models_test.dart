import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/sale_status.dart';
import 'package:hefesto/features/admin/ventas_extra/ventas_extra_models.dart';

// JSON con la forma real de los endpoints de /api/v1/admin/manual-sales
// (catalog, form-data, POST, GET :id). Los montos de Postgres pueden llegar
// como número o como string; las listas, vacías o ausentes.
void main() {
  group('parseMoney / moneyText', () {
    test('entiende los formatos que se tipean en el celu', () {
      expect(parseMoney('2500'), 2500);
      expect(parseMoney('2.500'), 2500);
      expect(parseMoney('2.500,50'), 2500.5);
      expect(parseMoney('2,500.50'), 2500.5);
      expect(parseMoney('2500,5'), 2500.5);
      expect(parseMoney('2500.5'), 2500.5);
      expect(parseMoney(r'$ 1.250.000'), 1250000);
      expect(parseMoney('0'), 0);
    });

    test('vacío o basura es null (no 0 en silencio)', () {
      expect(parseMoney(''), isNull);
      expect(parseMoney('   '), isNull);
      expect(parseMoney(null), isNull);
      expect(parseMoney('abc'), isNull);
      expect(parseMoney('1.2.3,4,5'), isNull);
    });

    test('moneyText no deja decimales de más', () {
      expect(moneyText(2500), '2500');
      expect(moneyText(2500.5), '2500.5');
      expect(moneyText(null), '');
      expect(parseMoney(moneyText(1234.56)), 1234.56);
    });
  });

  group('catálogo', () {
    final json = {
      'total': 2,
      'items': [
        {
          'id': 'p1',
          'name': 'Mate Mario',
          'categoryName': 'Mates',
          'price': 30000,
          'colorMode': 'single',
          'colors': [
            {'name': 'Rojo', 'hex': '#CC2200'},
            {'name': 'Blanco', 'hex': null},
          ],
          'variants': ['Chico', 'Grande'],
          'options': [
            {'variantLabel': 'Chico', 'color': 'Rojo', 'unitPrice': 30000, 'weightGrams': 120, 'extrasCost': 0, 'hasStock': true},
            {'variantLabel': 'Chico', 'color': 'Blanco', 'unitPrice': '30000.00', 'weightGrams': 120, 'extrasCost': 0, 'hasStock': false},
            {'variantLabel': 'Grande', 'color': 'Rojo', 'unitPrice': 45000, 'weightGrams': 250, 'extrasCost': 500, 'hasStock': true},
            {'variantLabel': 'Grande', 'color': 'Blanco', 'unitPrice': 45000, 'weightGrams': 250, 'extrasCost': 500, 'hasStock': true},
          ],
        },
        {
          'id': 'p2',
          'name': 'Dumpling',
          'categoryName': null,
          'price': 8000,
          'colorMode': 'multi',
          'colors': <dynamic>[],
          'variants': <dynamic>[],
          'options': [
            {'variantLabel': null, 'color': null, 'unitPrice': 8000, 'weightGrams': 0, 'extrasCost': 0, 'hasStock': false},
          ],
        },
      ],
    };

    test('parsea productos con tamaños, colores y opciones', () {
      final page = SaleCatalogPage.fromJson(json);
      expect(page.total, 2);
      final mate = page.items.first;
      expect(mate.name, 'Mate Mario');
      expect(mate.isMulti, isFalse);
      expect(mate.colors.map((c) => c.name), ['Rojo', 'Blanco']);
      expect(mate.colors.first.hex, '#CC2200');
      expect(mate.colors.last.hex, isNull);
      expect(mate.defaultVariant, 'Chico');
      expect(mate.defaultColor, 'Rojo');
      expect(mate.options, hasLength(4));
      // Los montos como string también se leen.
      expect(mate.optionFor('Chico', 'Blanco')!.unitPrice, 30000);
    });

    test('optionFor devuelve la combinación exacta y, si falta, la más parecida', () {
      final mate = SaleCatalogPage.fromJson(json).items.first;
      expect(mate.optionFor('Grande', 'Rojo')!.unitPrice, 45000);
      expect(mate.optionFor('Grande', 'Rojo')!.extrasCost, 500);
      // Color que el servidor no mandó: cae a la misma variante.
      expect(mate.optionFor('Grande', 'Verde')!.variantLabel, 'Grande');
      expect(mate.optionFor('Inexistente', null), isNotNull);
    });

    test('rango de precios y aviso de "sin carrete"', () {
      final page = SaleCatalogPage.fromJson(json);
      expect(page.items.first.priceRange, (min: 30000.0, max: 45000.0));
      expect(page.items.first.noneHasStock, isFalse);
      final dumpling = page.items.last;
      expect(dumpling.isMulti, isTrue);
      expect(dumpling.categoryName, isNull);
      expect(dumpling.defaultColor, isNull);
      expect(dumpling.noneHasStock, isTrue);
    });

    test('tolera una respuesta vacía o incompleta', () {
      expect(SaleCatalogPage.fromJson({}).items, isEmpty);
      final p = SaleCatalogProduct.fromJson({'id': 'x', 'name': '  '});
      expect(p.name, 'Producto');
      expect(p.options, isEmpty);
      expect(p.priceRange, (min: 0.0, max: 0.0));
    });
  });

  test('form-data: categorías y clientes anteriores', () {
    final d = SaleFormData.fromJson({
      'categories': ['Llaveros', 'Mates'],
      'recentCustomers': ['Juan Pérez', 'Ana'],
    });
    expect(d.categories, ['Llaveros', 'Mates']);
    expect(d.recentCustomers.first, 'Juan Pérez');
    expect(SaleFormData.fromJson({}).categories, isEmpty);
  });

  test('crear: lee id y total', () {
    final c = CreatedSale.fromJson({'id': 'abc', 'total': 12500.5, 'status': 'pending_payment'});
    expect(c.id, 'abc');
    expect(c.total, 12500.5);
  });

  group('borrador de la venta', () {
    SaleDraftLine catalogLine({int qty = 1, double? price = 30000, bool stock = true}) => SaleDraftLine(
          uid: 1,
          productId: 'p1',
          name: 'Mate Mario',
          variantLabel: 'Grande',
          color: 'Rojo',
          quantity: qty,
          unitPrice: price,
          catalogPrice: 30000,
          hasStock: stock,
        );

    SaleDraftLine freeLine({double? cost = 500}) => SaleDraftLine(
          uid: 2,
          name: 'Reparación',
          quantity: 2,
          unitPrice: 3000,
          unitCost: cost,
        );

    test('el total suma líneas por cantidad más los insumos cobrados', () {
      final d = SaleDraft(
        customer: 'Juan',
        lines: [catalogLine(qty: 2), freeLine()],
        extras: [SaleDraftExtra(uid: 3, name: 'Argollas', cost: 150, qty: 2)],
      );
      expect(d.total, 66300); // 60000 + 6000 + 300
      expect(d.units, 4);
      expect(d.extrasTotal, 300);
    });

    test('dice qué falta, en orden', () {
      final d = SaleDraft();
      expect(d.problem, 'Falta el nombre del cliente.');
      d.customer = 'Juan';
      expect(d.problem, 'Agregá al menos un producto.');
      d.lines.add(freeLine(cost: null));
      expect(d.problem, contains('Cargá el costo de "Reparación"'));
      d.lines[0] = freeLine(cost: 0); // 0 explícito es válido
      expect(d.problem, isNull);
      d.lines[0] = d.lines[0].copyWith(unitPrice: null);
      expect(d.problem, contains('Poné el precio'));
      d.lines[0] = d.lines[0].copyWith(unitPrice: 0, unitCost: 0);
      expect(d.problem, 'El total tiene que ser mayor a 0.');
    });

    test('un insumo a medio cargar bloquea, uno vacío se ignora', () {
      final d = SaleDraft(customer: 'Juan', lines: [catalogLine()]);
      d.extras.add(SaleDraftExtra(uid: 5)); // vacío
      expect(d.problem, isNull);
      expect(d.toJson().containsKey('extras'), isFalse);
      d.extras[0] = d.extras[0].copyWith(name: 'Vaso');
      expect(d.problem, 'Completá el costo del insumo.');
    });

    test('un producto con carrete NO manda costo; uno sin carrete sí', () {
      final con = catalogLine().toJson();
      expect(con.containsKey('unitCost'), isFalse);
      expect(con['productId'], 'p1');
      expect(con['variantLabel'], 'Grande');
      expect(con['color'], 'Rojo');
      expect(con['unitPrice'], 30000);

      final sin = catalogLine(stock: false).copyWith(unitCost: 9000).toJson();
      expect(sin['unitCost'], 9000);

      final libre = freeLine().toJson();
      expect(libre.containsKey('productId'), isFalse);
      expect(libre['productName'], 'Reparación');
      expect(libre['unitCost'], 500);
    });

    test('el cuerpo de POST tiene lo que espera el servidor', () {
      final d = SaleDraft(
        customer: '  Juan Pérez ',
        date: DateTime(2026, 10, 5),
        category: 'Mates',
        paymentMethod: 'transfer',
        status: SaleStatus.confirmed,
        lines: [catalogLine(qty: 2)],
        extras: [SaleDraftExtra(uid: 3, name: ' Argollas ', cost: 150, qty: 2)],
      );
      final j = d.toJson();
      expect(j['saleDate'], '2026-10-05');
      expect(j['customerName'], 'Juan Pérez');
      expect(j['paymentMethod'], 'transfer');
      expect(j['status'], 'confirmed');
      expect(j['category'], 'Mates');
      expect(j.containsKey('detail'), isFalse); // vacío: lo arma el servidor
      expect((j['items'] as List), hasLength(1));
      expect(j['extras'], [
        {'name': 'Argollas', 'cost': 150.0, 'qty': 2},
      ]);
    });

    test('copyWith puede borrar el precio (campo vacío) sin perder el resto', () {
      final l = catalogLine(qty: 3).copyWith(unitPrice: null);
      expect(l.unitPrice, isNull);
      expect(l.quantity, 3);
      expect(l.lineTotal, 0);
      expect(l.hasStock, isTrue);
    });

    test('misma elección = misma clave; el texto libre nunca se junta', () {
      final a = catalogLine();
      final b = SaleDraftLine(uid: 9, productId: 'p1', name: 'Mate Mario', variantLabel: 'Grande', color: 'Rojo');
      expect(a.mergeKey, b.mergeKey);
      expect(freeLine().mergeKey, isNot(SaleDraftLine(uid: 7, name: 'Reparación').mergeKey));
    });
  });

  group('edición', () {
    test('lee la venta con costo y ganancia', () {
      final e = ManualSaleEditData.fromJson({
        'id': 'm1',
        'saleDate': '2026-10-29T12:00:00.000Z',
        'customerName': 'Cliente de feria',
        'detail': '5 llaveros',
        'category': 'Llaveros',
        'status': 'delivered',
        'paymentMethod': 'cash',
        'quantity': 5,
        'total': 10000,
        'amortization': '3500.00',
        'profit': 6500,
        'cancelReason': null,
        'items': <dynamic>[],
      });
      expect(e.customerName, 'Cliente de feria');
      expect(e.total, 10000);
      expect(e.amortization, 3500);
      expect(e.profit, 6500);
      expect(e.status, SaleStatus.delivered);
      expect(e.quantity, 5);
    });

    test('ventas viejas o roles sin acceso al costo: amortization null', () {
      final e = ManualSaleEditData.fromJson({
        'id': 'm2',
        'saleDate': '2026-10-29T12:00:00.000Z',
        'customerName': 'X',
        'status': 'pending_payment',
        'paymentMethod': 'transfer',
        'quantity': 0,
        'total': '800',
        'amortization': null,
        'profit': null,
      });
      expect(e.amortization, isNull);
      expect(e.detail, isNull);
      expect(e.quantity, 1);
      expect(e.total, 800);
    });

    test('el PATCH manda todo lo que pide el schema de la web', () {
      final b = manualSaleEditBody(
        date: DateTime(2026, 1, 9),
        customer: ' Ana ',
        detail: '',
        category: ' ',
        total: 12000,
        amortization: 4000,
        paymentMethod: 'mercadopago',
      );
      expect(b, {
        'saleDate': '2026-01-09',
        'customerName': 'Ana',
        'detail': '',
        'category': '',
        'total': 12000,
        'amortization': 4000,
        'paymentMethod': 'mercadopago',
      });
    });

    test('la ganancia se calcula como el servidor: max(0, total − costo)', () {
      expect(editedProfit(10000, 3500), 6500);
      expect(editedProfit(1000, 1500), 0);
      expect(editedProfit(1000, -50), 1000);
      expect(editedProfit(100.1, 33.33), 66.77);
    });
  });
}
