import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/consultas/consultas_api.dart' show InquiryMove;
import 'package:hefesto/features/admin/consultas/consultas_models.dart';
import 'package:hefesto/features/admin/consultas/consultas_widgets.dart';
import 'package:intl/date_symbol_data_local.dart';

const sampleMessage = '¡Hola! Te paso la cotización:\n\n'
    '📦 PRODUCTO: Llavero con logo (x12)\n'
    '💲 Precio (Por unidad): \$2.500 c/u\n'
    '💲 Total (12 unidades): \$30.000\n\n'
    '⏱ DEMORA ESTIMADA: 5 días hábiles\n\n'
    'Para confirmar se pide una seña del 50%.';

/// Una consulta con la forma real de `InquiryView` (`/api/v1/admin/consultas`).
Map<String, dynamic> inquiryJson(
  String id, {
  String customerName = 'Carla Gómez',
  String? customerPhone = '+54 9 11 2345-6789',
  String title = 'Llavero con logo',
  String description = 'Con el escudo del club, de 5 cm.',
  int quantity = 12,
  List<String> images = const [],
  List<Map<String, dynamic>> files = const [],
  String status = 'pending',
  Object? unitPrice,
  Object? unitCost,
  String? estFilamentId,
  String? estMaterial,
  Object? estGrams,
  int? estMinutes,
  String? saleId,
  Object? bulkPrice,
  int? bulkFrom,
  String? dimensions,
  String? colors,
  String? deliveryTime,
  String? answerNote,
  String? message,
  String author = 'Antonella',
  String? answeredBy,
  bool mine = false,
  String createdAt = '2026-11-16T14:00:00.000Z',
  String? answeredAt,
  String? confirmedAt,
}) =>
    {
      'id': id,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'title': title,
      'description': description,
      'quantity': quantity,
      'images': images,
      'files': files,
      'status': status,
      'unitPrice': unitPrice,
      'unitCost': unitCost,
      'estFilamentId': estFilamentId,
      'estMaterial': estMaterial,
      'estGrams': estGrams,
      'estMinutes': estMinutes,
      'saleId': saleId,
      'bulkPrice': bulkPrice,
      'bulkFrom': bulkFrom,
      'dimensions': dimensions,
      'colors': colors,
      'deliveryTime': deliveryTime,
      'answerNote': answerNote,
      'message': message,
      'author': author,
      'answeredBy': answeredBy,
      'mine': mine,
      'createdAt': createdAt,
      'answeredAt': answeredAt,
      'confirmedAt': confirmedAt,
    };

/// La misma consulta ya respondida por el operador. Por defecto es una
/// respuesta VIEJA (costo cargado a mano, `unitCost`); con [withCalc] es una
/// de las de ahora: el costo sale de los datos de la calculadora.
Map<String, dynamic> answeredJson(
  String id, {
  bool withCalc = false,
  String status = 'answered',
  int quantity = 12,
  String? customerPhone = '+54 9 11 2345-6789',
  String message = sampleMessage,
  bool mine = false,
  String? confirmedAt,
  String? saleId,
  List<Map<String, dynamic>> files = const [],
}) =>
    inquiryJson(
      id,
      status: status,
      quantity: quantity,
      customerPhone: customerPhone,
      saleId: saleId,
      files: files,
      unitPrice: 2500,
      unitCost: withCalc ? null : 900,
      estFilamentId: withCalc ? '11111111-1111-4111-8111-111111111111' : null,
      estMaterial: withCalc ? 'PLA' : null,
      estGrams: withCalc ? 18.5 : null,
      estMinutes: withCalc ? 95 : null,
      bulkPrice: 2000,
      bulkFrom: 50,
      dimensions: '5 × 5 cm',
      colors: 'negro, dorado',
      deliveryTime: '5 días hábiles',
      answerNote: 'Con argolla incluida.',
      message: message,
      answeredBy: 'Lucas',
      mine: mine,
      answeredAt: '2026-11-16T16:30:00.000Z',
      confirmedAt: confirmedAt,
    );

/// JSON con la forma real de `GET /api/v1/admin/consultas`.
Map<String, dynamic> consultasJson() => {
      'items': [
        inquiryJson('c1', mine: true, images: [
          'https://cdn.test/consultas/c1/a.jpg'
        ], files: [
          {'url': 'https://cdn.test/consultas/c1/files/a.ogg', 'name': 'audio del cliente.ogg', 'type': 'audio/ogg'},
          {'url': 'https://cdn.test/consultas/c1/files/b.pdf', 'name': 'diseño.pdf', 'type': 'application/pdf'},
        ]),
        answeredJson('c2'),
        // Confirmada: el servidor ya creó el pedido.
        answeredJson('c3', status: 'confirmed', confirmedAt: '2026-11-17T10:00:00.000Z', saleId: 'sale-33'),
        inquiryJson(
          'c4',
          customerName: 'Pedro',
          customerPhone: null,
          title: 'Maceta geométrica',
          description: '',
          quantity: 1,
          status: 'cancelled',
        ),
      ],
      'statuses': {
        'pending': 'Sin responder',
        'answered': 'Respondida',
        'confirmed': 'Confirmada',
        'cancelled': 'No se hizo',
      },
      'maxImages': 6,
      'maxFiles': 8,
      'paymentMethods': {'transfer': 'Transferencia', 'mercadopago': 'MercadoPago', 'cash': 'Efectivo'},
    };

void main() {
  setUpAll(() => initializeDateFormatting('es_AR'));

  group('ConsultasData.fromJson', () {
    final d = ConsultasData.fromJson(consultasJson());

    test('lee una consulta sin responder', () {
      expect(d.items, hasLength(4));
      final q = d.items.first;
      expect(q.id, 'c1');
      expect(q.customerName, 'Carla Gómez');
      expect(q.customerPhone, '+54 9 11 2345-6789');
      expect(q.title, 'Llavero con logo');
      expect(q.quantity, 12);
      expect(q.images, hasLength(1));
      expect(q.status, InquiryStatus.pending);
      expect(q.unitPrice, isNull);
      expect(q.unitCost, isNull);
      expect(q.saleId, isNull);
      expect(q.hasOrder, isFalse);
      expect(q.files.map((f) => f.name), ['audio del cliente.ogg', 'diseño.pdf']);
      expect(q.files.first.url, 'https://cdn.test/consultas/c1/files/a.ogg');
      expect(q.files.first.type, 'audio/ogg');
      expect(q.bulkPrice, isNull);
      expect(q.bulkFrom, isNull);
      expect(q.message, isNull);
      expect(q.answeredBy, isNull);
      expect(q.author, 'Antonella');
      expect(q.mine, isTrue);
      expect(q.createdAt, DateTime.utc(2026, 11, 16, 14).toLocal());
      expect(q.answeredAt, isNull);
      expect(q.isOpen, isTrue);
    });

    test('lee una consulta respondida', () {
      final q = d.items[1];
      expect(q.status, InquiryStatus.answered);
      expect(q.unitPrice, 2500);
      expect(q.unitCost, 900);
      expect(q.files, isEmpty);
      expect(q.saleId, isNull);
      expect(d.items[2].saleId, 'sale-33');
      expect(d.items[2].hasOrder, isTrue);
      expect(q.bulkPrice, 2000);
      expect(q.bulkFrom, 50);
      expect(q.dimensions, '5 × 5 cm');
      expect(q.colors, 'negro, dorado');
      expect(q.deliveryTime, '5 días hábiles');
      expect(q.answerNote, 'Con argolla incluida.');
      expect(q.message, sampleMessage);
      expect(q.answeredBy, 'Lucas');
      expect(q.answeredAt, isNotNull);
      expect(q.isOpen, isTrue);
      expect(d.items[2].confirmedAt, isNotNull);
      expect(d.items[2].isOpen, isFalse);
      expect(d.items[3].customerPhone, isNull);
      expect(d.items[3].description, '');
    });

    test('precios como texto (numeric de Postgres) y datos rotos no rompen', () {
      final q = Consulta.fromJson(
          inquiryJson('z', unitPrice: '1250.50', unitCost: '480.25', bulkPrice: '900', bulkFrom: 10));
      expect(q.unitPrice, 1250.5);
      expect(q.unitCost, 480.25);
      expect(q.bulkPrice, 900);

      final odd = ConsultasData.fromJson({
        'items': [
          {
            'id': 'w',
            'status': 'archivada',
            'quantity': 0,
            'images': null,
            'author': null,
            'files': [
              {'url': '', 'name': 'sin dirección'},
              {'url': 'https://cdn.test/x.bin'},
              'basura',
            ],
          },
          42,
        ],
        'maxFiles': 0,
        'paymentMethods': {'cash': 'Billetes'},
      });
      expect(odd.items, hasLength(1));
      final w = odd.items.single;
      expect(w.status, InquiryStatus.pending, reason: 'un estado desconocido queda sin responder');
      expect(w.quantity, 1, reason: 'la cantidad nunca baja de 1');
      expect(w.images, isEmpty);
      // Adjuntos: sin dirección no sirve; sin nombre ni tipo, igual se lista.
      expect(w.files, hasLength(1));
      expect(w.files.single.name, 'archivo');
      expect(w.files.single.type, '');
      expect(odd.maxFiles, 8);
      // Siempre los tres medios, en orden; del servidor sale el rótulo.
      expect(odd.paymentMethods, [('transfer', 'Transferencia'), ('mercadopago', 'MercadoPago'), ('cash', 'Billetes')]);
      expect(w.author, 'Alguien del equipo');
      expect(odd.maxImages, 6);
      expect(odd.labelOf(InquiryStatus.cancelled), 'No se hizo');
      expect(ConsultasData.fromJson({}).items, isEmpty);
    });

    test('rótulos, tope de fotos y filtros con sus cuentas', () {
      expect(d.labelOf(InquiryStatus.pending), 'Sin responder');
      expect(d.labelOf(InquiryStatus.answered), 'Respondida');
      expect(d.labelOf(InquiryStatus.confirmed), 'Confirmada');
      expect(d.labelOf(InquiryStatus.cancelled), 'No se hizo');
      expect(d.maxImages, 6);
      expect(d.maxFiles, 8);
      expect(d.paymentMethods.map((m) => m.$1), ['transfer', 'mercadopago', 'cash']);
      expect(d.paymentMethods.first.$2, 'Transferencia');
      expect(ConsultasData.fromJson({}).paymentMethods, defaultPaymentMethods);
      expect(d.count(InquiryFilter.open), 2);
      expect(d.count(InquiryFilter.pending), 1);
      expect(d.count(InquiryFilter.answered), 1);
      expect(d.count(InquiryFilter.confirmed), 1);
      expect(d.count(InquiryFilter.cancelled), 1);
      expect(d.count(InquiryFilter.all), 4);
      expect(InquiryFilter.values.map((f) => f.label),
          ['Abiertas', 'Sin responder', 'Respondidas', 'Confirmadas', 'No se hicieron', 'Todas']);
    });
  });

  group('reglas de una consulta', () {
    final d = ConsultasData.fromJson(consultasJson());

    test('título con cantidad (sin prefijo cuando es una)', () {
      expect(d.items[0].heading, '12 × Llavero con logo');
      expect(d.items[3].heading, 'Maceta geométrica');
    });

    test('total = precio × cantidad, solo con más de una unidad', () {
      expect(d.items[1].total, 30000);
      expect(d.items[0].total, isNull, reason: 'sin precio todavía');
      expect(Consulta.fromJson(answeredJson('u', quantity: 1)).total, isNull);
    });

    test('total del pedido al confirmar = precio × cantidad (también con una unidad)', () {
      expect(d.items[1].orderTotal, 30000);
      expect(Consulta.fromJson(answeredJson('u', quantity: 1)).orderTotal, 2500);
      expect(d.items[0].orderTotal, isNull);
    });

    test('el costo es interno: no aparece en el resumen que acompaña al mensaje', () {
      final lines = consultaPriceLines(d.items[1]).join(' ');
      expect(lines.contains('900'), isFalse);
      expect(lines.toLowerCase().contains('costo'), isFalse);
    });

    test('resumen de precio como el resto de la app', () {
      expect(consultaPriceLines(d.items[1]), [
        r'Precio: $2.500 c/u',
        r'Total (12 unidades): $30.000',
        r'Desde 50 unidades: $2.000 c/u',
      ]);
      final one = Consulta.fromJson(inquiryJson('o', quantity: 1, unitPrice: 18000, message: 'Hola'));
      expect(consultaPriceLines(one), [r'Precio: $18.000']);
      expect(consultaPriceLines(d.items[0]), isEmpty);
    });

    test('borrar: con el permiso, o si es mía y nadie respondió', () {
      expect(d.items[0].deletableBy(canDelete: false), isTrue);
      expect(d.items[1].deletableBy(canDelete: false), isFalse);
      expect(d.items[1].deletableBy(canDelete: true), isTrue);
      final mineAnswered = Consulta.fromJson(answeredJson('m', mine: true));
      expect(mineAnswered.deletableBy(canDelete: false), isFalse, reason: 'mía pero ya respondida');
    });
  });

  group('lo que se manda', () {
    test('alta: recorta y omite el teléfono vacío', () {
      const full = ConsultaDraft(
        customerName: ' Carla ',
        customerPhone: ' 11 2345 6789 ',
        title: ' Llavero ',
        description: ' Con logo ',
        quantity: 12,
      );
      expect(full.toJson(), {
        'customerName': 'Carla',
        'customerPhone': '11 2345 6789',
        'title': 'Llavero',
        'description': 'Con logo',
        'quantity': 12,
      });
      const minimal = ConsultaDraft(customerName: 'Pedro', title: 'Maceta', quantity: 1);
      expect(minimal.toJson(), {'customerName': 'Pedro', 'title': 'Maceta', 'description': '', 'quantity': 1});
    });

    const calc = RespuestaCalc(filamentId: 'f1', material: 'PLA', grams: 18.5, printMinutes: 95);

    test('respuesta con la calculadora: van filamento, gramos y minutos, y el costo va null', () {
      const draft = RespuestaDraft(unitPrice: 2500, calc: calc, legacyUnitCost: 900, deliveryTime: ' 5 días ', note: '  ');
      expect(draft.toJson(), {
        'unitPrice': 2500,
        'unitCost': null,
        'filamentId': 'f1',
        'material': 'PLA',
        'grams': 18.5,
        'printMinutes': 95,
        'bulkPrice': null,
        'bulkFrom': null,
        'dimensions': null,
        'colors': null,
        'deliveryTime': '5 días',
        'note': null,
        'message': null,
      });
    });

    test('respuesta vieja sin recalcular: se reenvía su costo y nada de la calculadora', () {
      const draft = RespuestaDraft(unitPrice: 3000, legacyUnitCost: 900);
      final json = draft.toJson();
      expect(json['unitCost'], 900);
      for (final k in ['filamentId', 'material', 'grams', 'printMinutes']) {
        expect(json.containsKey(k), isTrue);
        expect(json[k], isNull);
      }
    });

    test('respuesta completa con mensaje a mano', () {
      const draft = RespuestaDraft(
        unitPrice: 2500,
        calc: calc,
        bulkPrice: 2000,
        bulkFrom: 50,
        dimensions: '5 × 5 cm',
        colors: 'negro',
        deliveryTime: '5 días',
        note: 'Con argolla',
        message: ' Hola Carla, sale 2500. ',
      );
      final json = draft.toJson();
      expect(json['bulkPrice'], 2000);
      expect(json['bulkFrom'], 50);
      expect(json['message'], 'Hola Carla, sale 2500.');
    });

    test('datos de la calculadora: completos solo con filamento o material y gramos o minutos', () {
      expect(calc.isComplete, isTrue);
      expect(const RespuestaCalc(filamentId: null, material: 'PLA', grams: 0, printMinutes: 30).isComplete, isTrue);
      expect(const RespuestaCalc(filamentId: 'f1', material: null, grams: 0, printMinutes: 0).isComplete, isFalse);
      expect(const RespuestaCalc(filamentId: null, material: null, grams: 10, printMinutes: 0).isComplete, isFalse);
    });

    test('mensaje: solo se manda si el operador lo escribió o lo cambió', () {
      // Sin mensaje guardado: vacío = que lo arme el servidor.
      expect(messageToSend(typed: '', saved: null), isNull);
      expect(messageToSend(typed: '   ', saved: null), isNull);
      expect(messageToSend(typed: 'Hola, sale 2500.', saved: null), 'Hola, sale 2500.');
      // Con mensaje guardado y sin tocar: null, para que se rearme con los números nuevos.
      expect(messageToSend(typed: sampleMessage, saved: sampleMessage), isNull);
      expect(messageToSend(typed: '$sampleMessage\n', saved: sampleMessage), isNull);
      // Lo cambió: va el texto.
      expect(messageToSend(typed: '$sampleMessage ¡Gracias!', saved: sampleMessage), '$sampleMessage ¡Gracias!');
      // Lo borró entero: también se rearma.
      expect(messageToSend(typed: '', saved: sampleMessage), isNull);
    });

    test('cambios de estado de la API', () {
      expect(InquiryMove.values.map((m) => m.api), ['confirmed', 'cancelled', 'reopen']);
      expect(InquiryStatus.values.map((s) => s.api), ['pending', 'answered', 'confirmed', 'cancelled']);
    });
  });

  group('validateConsultaForm', () {
    Map<String, String> v({
      String name = 'Carla',
      String phone = '',
      String title = 'Llavero',
      String description = '',
      String quantity = '1',
    }) =>
        validateConsultaForm(
          customerName: name,
          customerPhone: phone,
          title: title,
          description: description,
          quantity: quantity,
        );

    test('lo mínimo válido: nombre, qué pide y cantidad', () {
      expect(v(), isEmpty);
      expect(v(description: 'x' * 4000, phone: '1' * 40, name: 'n' * 120, title: 't' * 160, quantity: '9999'), isEmpty);
    });

    test('marca cada campo que falta o se pasa', () {
      expect(v(name: '  ')['customerName'], 'Poné el nombre del cliente.');
      expect(v(name: 'n' * 121).keys, {'customerName'});
      expect(v(title: 'ab')['title'], 'Poné qué pide el cliente.');
      expect(v(title: 't' * 161).keys, {'title'});
      expect(v(phone: '1' * 41).keys, {'customerPhone'});
      expect(v(description: 'x' * 4001).keys, {'description'});
      expect(v(quantity: '0')['quantity'], 'La cantidad mínima es 1.');
      expect(v(quantity: '').keys, {'quantity'});
      expect(v(quantity: '2,5').keys, {'quantity'});
      expect(v(quantity: '10000').keys, {'quantity'});
    });
  });

  group('precio por unidad o por el total', () {
    test('al servidor va siempre el precio por unidad', () {
      expect(unitPriceFrom(2500, PriceMode.unit, 12), 2500);
      expect(unitPriceFrom(30000, PriceMode.total, 12), 2500);
      // Una sola unidad: el total ES el precio por unidad.
      expect(unitPriceFrom(2500, PriceMode.total, 1), 2500);
    });

    test('cambiar de modo convierte lo tipeado (a centavos)', () {
      expect(convertTypedPrice(2500, to: PriceMode.total, quantity: 12), 30000);
      expect(convertTypedPrice(30000, to: PriceMode.unit, quantity: 12), 2500);
      expect(convertTypedPrice(1000, to: PriceMode.unit, quantity: 3), 333.33);
    });

    test('la calculadora cotiza UNA pieza: en modo total se multiplica', () {
      expect(calculatorPriceFor(2900, PriceMode.unit, 12), 2900);
      expect(calculatorPriceFor(2900, PriceMode.total, 12), 34800);
    });
  });

  group('datos de la calculadora en la consulta', () {
    test('respuesta de ahora: trae filamento, material, gramos y minutos por unidad', () {
      final q = Consulta.fromJson(answeredJson('k', withCalc: true));
      expect(q.unitCost, isNull);
      expect(q.estFilamentId, '11111111-1111-4111-8111-111111111111');
      expect(q.estMaterial, 'PLA');
      expect(q.estGrams, 18.5);
      expect(q.estMinutes, 95);
      expect(q.calc!.grams, 18.5);
      expect(q.calc!.printMinutes, 95);
      expect(q.hasCostBasis, isTrue);
    });

    test('respuesta vieja: solo el costo a mano (sin datos de calculadora)', () {
      final q = Consulta.fromJson(answeredJson('v'));
      expect(q.calc, isNull);
      expect(q.unitCost, 900);
      expect(q.hasCostBasis, isTrue);
    });

    test('sin responder (o servidor viejo sin esos campos): nada', () {
      final q = Consulta.fromJson(inquiryJson('p'));
      expect(q.calc, isNull);
      expect(q.hasCostBasis, isFalse);
      final old = Consulta.fromJson(inquiryJson('p')..removeWhere((k, _) => k.startsWith('est')));
      expect(old.calc, isNull);
    });

    test('gramos como texto (numeric de la base) y solo minutos', () {
      final q = Consulta.fromJson(inquiryJson('t', estMaterial: 'PETG', estGrams: '12.50'));
      expect(q.calc!.grams, 12.5);
      expect(q.calc!.printMinutes, 0);
      final m = Consulta.fromJson(inquiryJson('t', estMaterial: 'PETG', estMinutes: 40));
      expect(m.calc!.grams, 0);
      expect(m.calc!.printMinutes, 40);
    });
  });

  group('validateRespuestaForm', () {
    Map<String, String> v({
      String unit = '2.500',
      bool basis = true,
      String bulk = '',
      String from = '',
      String note = '',
      PriceMode mode = PriceMode.unit,
      int quantity = 1,
    }) =>
        validateRespuestaForm(
          unitPrice: unit,
          hasCostBasis: basis,
          bulkPrice: bulk,
          bulkFrom: from,
          note: note,
          mode: mode,
          quantity: quantity,
        );

    test('sin calcular (ni costo viejo) pide la calculadora, con el texto del servidor', () {
      expect(v(basis: false)['calc'], 'Calculá el precio con la calculadora: así queda guardado el costo del pedido.');
      expect(v(basis: false).keys, {'calc'});
      expect(v(unit: '', basis: false).keys, {'unitPrice', 'calc'});
    });

    test('el precio es obligatorio y mayor a 0', () {
      expect(v(), isEmpty);
      expect(v(unit: '')['unitPrice'], 'Poné el precio por unidad.');
      expect(v(unit: '', mode: PriceMode.total, quantity: 12)['unitPrice'], 'Poné el precio por las 12.');
      expect(v(unit: '0')['unitPrice'], 'El precio tiene que ser mayor a 0.');
      expect(v(unit: 'abc').keys, {'unitPrice'});
      expect(v(unit: '1.250,50'), isEmpty);
    });

    test('precio por cantidad y "desde cuántas" van juntos o ninguno', () {
      expect(v(bulk: '2.000', from: '50'), isEmpty);
      expect(v(bulk: '2.000')['bulkFrom'], 'Poné desde cuántas unidades.');
      expect(v(from: '50')['bulkPrice'], 'Poné el precio por cantidad.');
      expect(v(bulk: '2.000', from: '1')['bulkFrom'], 'Mínimo 2 unidades.');
      expect(v(bulk: '0', from: '10')['bulkPrice'], 'El precio tiene que ser mayor a 0.');
      expect(v(bulk: '2.000', from: '10000').keys, {'bulkFrom'});
    });

    test('topes de los textos', () {
      expect(v(note: 'n' * 1001).keys, {'note'});
      expect(
        validateRespuestaForm(
          unitPrice: '1',
          hasCostBasis: true,
          bulkPrice: '',
          bulkFrom: '',
          dimensions: 'd' * 301,
          colors: 'c' * 301,
          deliveryTime: 't' * 121,
          message: 'm' * 6001,
        ).keys,
        {'dimensions', 'colors', 'deliveryTime', 'message'},
      );
    });
  });
}
