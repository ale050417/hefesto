import '../analisis/ar_number.dart';
import '../filamentos/parse_util.dart';

/// Estado de una consulta en la API.
enum InquiryStatus {
  pending('pending', 'Sin responder'),
  answered('answered', 'Respondida'),
  confirmed('confirmed', 'Confirmada'),
  cancelled('cancelled', 'No se hizo');

  const InquiryStatus(this.api, this.defaultLabel);
  final String api;

  /// Rótulo si el servidor no manda el suyo (`statuses`).
  final String defaultLabel;

  /// Un estado que la app no conoce (versión vieja) cae a "sin responder".
  static InquiryStatus parse(Object? v) =>
      values.firstWhere((s) => s.api == v, orElse: () => InquiryStatus.pending);
}

/// Adjunto de una consulta que no es foto: audio, video corto o PDF.
class ConsultaFile {
  const ConsultaFile({required this.url, required this.name, required this.type});
  final String url;
  final String name;

  /// Tipo de contenido ("audio/ogg", "application/pdf"…).
  final String type;

  factory ConsultaFile.fromJson(Map<String, dynamic> j) => ConsultaFile(
        url: strOf(j['url']),
        name: strOf(j['name'], 'archivo'),
        type: strOf(j['type']),
      );
}

/// Medios de pago al confirmar (clave de la API → rótulo si el servidor no
/// manda el suyo). El primero es el que viene elegido.
const defaultPaymentMethods = <(String, String)>[
  ('transfer', 'Transferencia'),
  ('mercadopago', 'MercadoPago'),
  ('cash', 'Efectivo'),
];

/// Lo que pregunta un cliente (fila de `/admin/consultas`): lo carga atención
/// al cliente, el operador le pone precio y el servidor arma el mensaje.
class Consulta {
  const Consulta({
    required this.id,
    required this.customerName,
    required this.title,
    required this.description,
    required this.quantity,
    required this.images,
    required this.status,
    required this.author,
    required this.mine,
    this.customerPhone,
    this.files = const [],
    this.unitPrice,
    this.unitCost,
    this.estFilamentId,
    this.estMaterial,
    this.estGrams,
    this.estMinutes,
    this.saleId,
    this.bulkPrice,
    this.bulkFrom,
    this.dimensions,
    this.colors,
    this.deliveryTime,
    this.answerNote,
    this.message,
    this.answeredBy,
    this.createdAt,
    this.answeredAt,
    this.confirmedAt,
  });

  final String id;
  final String customerName;
  final String? customerPhone;
  final String title;
  final String description;
  final int quantity;
  final List<String> images;

  /// Adjuntos que no son fotos (audios, videos, PDF).
  final List<ConsultaFile> files;
  final InquiryStatus status;

  // --- Respuesta del operador (todo null hasta que responde) ---
  final double? unitPrice;

  /// Costo por unidad cargado a mano en respuestas VIEJAS (hoy el costo sale
  /// de la calculadora, ver [calc]). Es interno: NUNCA se muestra, ni al
  /// cliente ni al operador; solo se reenvía tal cual al cambiar una respuesta
  /// vieja sin recalcular.
  final double? unitCost;

  /// Lo que dejó la calculadora (por unidad): con esto el servidor costea el
  /// pedido y descuenta el filamento al confirmar.
  final String? estFilamentId;
  final String? estMaterial;
  final double? estGrams;
  final int? estMinutes;

  /// Datos de la calculadora guardados con la respuesta, o null si no los hay
  /// (misma regla que la web: alcanza con que haya gramos o minutos).
  RespuestaCalc? get calc => (estGrams == null && estMinutes == null)
      ? null
      : RespuestaCalc(
          filamentId: estFilamentId,
          material: estMaterial,
          grams: estGrams ?? 0,
          printMinutes: estMinutes ?? 0,
        );

  /// La respuesta ya tiene con qué costear el pedido (calculadora o costo viejo).
  bool get hasCostBasis => calc != null || unitCost != null;

  /// Pedido que se creó al confirmar (null si todavía no hay).
  final String? saleId;

  /// Precio por unidad comprando [bulkFrom] o más (van juntos, o ninguno).
  final double? bulkPrice;
  final int? bulkFrom;
  final String? dimensions;
  final String? colors;
  final String? deliveryTime;
  final String? answerNote;

  /// Mensaje listo para mandarle al cliente.
  final String? message;

  /// Quién la cargó y quién la respondió.
  final String author;
  final String? answeredBy;

  /// La cargó quien está mirando (puede borrarla mientras nadie responda).
  final bool mine;
  final DateTime? createdAt;
  final DateTime? answeredAt;
  final DateTime? confirmedAt;

  /// "12 × Llavero" (sin el número cuando es una sola unidad).
  String get heading => quantity > 1 ? '$quantity × $title' : title;

  /// Total del pedido (precio × cantidad); null si es una unidad o no hay precio.
  double? get total => (unitPrice != null && quantity > 1) ? unitPrice! * quantity : null;

  /// Lo que va a valer el pedido al confirmar (precio × cantidad).
  double? get orderTotal => unitPrice == null ? null : unitPrice! * quantity;

  /// Ya generó un pedido: no se puede reabrir (el pedido sigue su camino en
  /// Ventas y en la cola).
  bool get hasOrder => saleId != null;

  /// Sigue en juego: se puede responder (o cambiar la respuesta) y descartar.
  bool get isOpen => status == InquiryStatus.pending || status == InquiryStatus.answered;

  /// Regla del servidor: la borra quien tiene `consultas/eliminar`, o quien la
  /// cargó mientras nadie la respondió.
  bool deletableBy({required bool canDelete}) =>
      canDelete || (mine && status == InquiryStatus.pending);

  factory Consulta.fromJson(Map<String, dynamic> j) {
    double? money(Object? v) => v == null ? null : numOf(v);
    final qty = intOf(j['quantity'], 1);
    final from = j['bulkFrom'] == null ? null : intOf(j['bulkFrom']);
    return Consulta(
      id: strOf(j['id']),
      customerName: strOf(j['customerName']),
      customerPhone: strOrNull(j['customerPhone']),
      title: strOf(j['title']),
      description: strOf(j['description']),
      quantity: qty < 1 ? 1 : qty,
      images: stringsOf(j['images']),
      files: [
        for (final m in mapsOf(j['files']))
          if (strOf(m['url']).isNotEmpty) ConsultaFile.fromJson(m),
      ],
      status: InquiryStatus.parse(j['status']),
      unitPrice: money(j['unitPrice']),
      unitCost: money(j['unitCost']),
      estFilamentId: strOrNull(j['estFilamentId']),
      estMaterial: strOrNull(j['estMaterial']),
      estGrams: money(j['estGrams']),
      estMinutes: j['estMinutes'] == null ? null : numOf(j['estMinutes']).round(),
      saleId: strOrNull(j['saleId']),
      bulkPrice: money(j['bulkPrice']),
      bulkFrom: from,
      dimensions: strOrNull(j['dimensions']),
      colors: strOrNull(j['colors']),
      deliveryTime: strOrNull(j['deliveryTime']),
      answerNote: strOrNull(j['answerNote']),
      message: strOrNull(j['message']),
      author: strOf(j['author'], 'Alguien del equipo'),
      answeredBy: strOrNull(j['answeredBy']),
      mine: boolOf(j['mine']),
      createdAt: dateOf(j['createdAt']),
      answeredAt: dateOf(j['answeredAt']),
      confirmedAt: dateOf(j['confirmedAt']),
    );
  }
}

/// Filtros del listado (chips).
enum InquiryFilter {
  open('Abiertas'),
  pending('Sin responder'),
  answered('Respondidas'),
  confirmed('Confirmadas'),
  cancelled('No se hicieron'),
  all('Todas');

  const InquiryFilter(this.label);
  final String label;

  bool matches(Consulta q) => switch (this) {
        InquiryFilter.open => q.isOpen,
        InquiryFilter.pending => q.status == InquiryStatus.pending,
        InquiryFilter.answered => q.status == InquiryStatus.answered,
        InquiryFilter.confirmed => q.status == InquiryStatus.confirmed,
        InquiryFilter.cancelled => q.status == InquiryStatus.cancelled,
        InquiryFilter.all => true,
      };
}

/// Todo lo que devuelve `GET /admin/consultas`.
class ConsultasData {
  const ConsultasData({
    required this.items,
    required this.labels,
    required this.maxImages,
    this.maxFiles = 8,
    this.paymentMethods = defaultPaymentMethods,
  });

  final List<Consulta> items;
  final Map<InquiryStatus, String> labels;

  /// Tope de fotos de referencia por consulta.
  final int maxImages;

  /// Tope de adjuntos que no son fotos.
  final int maxFiles;

  /// Medios de pago para elegir al confirmar: (clave de la API, rótulo).
  final List<(String, String)> paymentMethods;

  String labelOf(InquiryStatus s) => labels[s] ?? s.defaultLabel;

  int count(InquiryFilter f) => items.where(f.matches).length;

  factory ConsultasData.fromJson(Map<String, dynamic> j) {
    final raw = j['statuses'];
    final max = intOf(j['maxImages'], 6);
    final maxFiles = intOf(j['maxFiles'], 8);
    final pay = j['paymentMethods'];
    return ConsultasData(
      items: [for (final m in mapsOf(j['items'])) Consulta.fromJson(m)],
      labels: {
        for (final s in InquiryStatus.values)
          s: strOf(raw is Map ? raw[s.api] : null, s.defaultLabel),
      },
      maxImages: max > 0 ? max : 6,
      maxFiles: maxFiles > 0 ? maxFiles : 8,
      // Siempre los tres que acepta la API y en el mismo orden (transferencia
      // primero, que es el que usa por defecto); del servidor sale el rótulo.
      paymentMethods: [
        for (final (key, label) in defaultPaymentMethods)
          (key, strOf(pay is Map ? pay[key] : null, label)),
      ],
    );
  }
}

/// Lo que carga atención al cliente.
class ConsultaDraft {
  const ConsultaDraft({
    required this.customerName,
    required this.title,
    required this.quantity,
    this.customerPhone = '',
    this.description = '',
  });

  final String customerName;
  final String customerPhone;
  final String title;
  final String description;
  final int quantity;

  Map<String, dynamic> toJson() => {
        'customerName': customerName.trim(),
        if (customerPhone.trim().isNotEmpty) 'customerPhone': customerPhone.trim(),
        'title': title.trim(),
        'description': description.trim(),
        'quantity': quantity,
      };
}

/// Validación del alta de una consulta (mismas reglas que `inquiryCreateSchema`
/// del servidor, que igual vuelve a validar). Mapa campo → mensaje.
Map<String, String> validateConsultaForm({
  required String customerName,
  required String customerPhone,
  required String title,
  required String description,
  required String quantity,
}) {
  final errors = <String, String>{};
  final name = customerName.trim();
  if (name.isEmpty) {
    errors['customerName'] = 'Poné el nombre del cliente.';
  } else if (name.length > 120) {
    errors['customerName'] = 'El nombre puede tener hasta 120 letras.';
  }
  if (customerPhone.trim().length > 40) {
    errors['customerPhone'] = 'El WhatsApp puede tener hasta 40 caracteres.';
  }
  final t = title.trim();
  if (t.length < 3) {
    errors['title'] = 'Poné qué pide el cliente.';
  } else if (t.length > 160) {
    errors['title'] = 'Puede tener hasta 160 letras.';
  }
  if (description.trim().length > 4000) {
    errors['description'] = 'Los detalles pueden tener hasta 4000 letras.';
  }
  final q = int.tryParse(quantity.trim());
  if (q == null || q < 1) {
    errors['quantity'] = 'La cantidad mínima es 1.';
  } else if (q > 9999) {
    errors['quantity'] = 'La cantidad máxima es 9999.';
  }
  return errors;
}

/// Lo que deja la calculadora al cotizar UNA pieza: filamento, gramos y
/// minutos. El servidor saca de acá el costo (el operador nunca lo ve).
class RespuestaCalc {
  const RespuestaCalc({
    required this.filamentId,
    required this.material,
    required this.grams,
    required this.printMinutes,
  });

  final String? filamentId;
  final String? material;

  /// Por unidad.
  final double grams;
  final int printMinutes;

  /// Lo mismo que exige `inquiryAnswerSchema`: un filamento (o material) y
  /// gramos o minutos.
  bool get isComplete => (filamentId != null || material != null) && (grams > 0 || printMinutes > 0);
}

/// Cómo se está tipeando el precio: por unidad o por toda la cantidad pedida
/// ("el lote"). Al servidor siempre va el precio por unidad.
enum PriceMode { unit, total }

/// Precio por unidad a partir de lo tipeado ([typed]) según el modo.
double unitPriceFrom(double typed, PriceMode mode, int quantity) =>
    mode == PriceMode.total && quantity > 1 ? typed / quantity : typed;

/// El mismo precio expresado en el otro modo (al tocar "Por unidad" / "Por
/// las N"), redondeado a centavos como en la web.
double convertTypedPrice(double typed, {required PriceMode to, required int quantity}) {
  final value = to == PriceMode.total ? typed * quantity : typed / quantity;
  return (value * 100).round() / 100;
}

/// Qué va en el campo cuando la calculadora devuelve un precio: cotiza UNA
/// pieza, así que en modo total se multiplica por la cantidad.
double calculatorPriceFor(double piecePrice, PriceMode mode, int quantity) =>
    mode == PriceMode.total ? piecePrice * quantity : piecePrice;

/// Respuesta del operador a una consulta.
class RespuestaDraft {
  const RespuestaDraft({
    required this.unitPrice,
    this.calc,
    this.legacyUnitCost,
    this.bulkPrice,
    this.bulkFrom,
    this.dimensions = '',
    this.colors = '',
    this.deliveryTime = '',
    this.note = '',
    this.message,
  });

  final double unitPrice;

  /// Datos de la calculadora (lo normal).
  final RespuestaCalc? calc;

  /// Costo de una respuesta vieja, cargado a mano en su momento: se reenvía
  /// solo si no hay [calc] (igual que la web).
  final double? legacyUnitCost;
  final double? bulkPrice;
  final int? bulkFrom;
  final String dimensions;
  final String colors;
  final String deliveryTime;
  final String note;

  /// Mensaje escrito a mano. `null` = que lo arme el servidor con los datos de
  /// arriba (lo normal: así queda siempre al día con el precio).
  final String? message;

  static String? _opt(String v) => v.trim().isEmpty ? null : v.trim();

  /// Todo va explícito (lo vacío como `null`): el servidor guarda la respuesta
  /// entera cada vez, así un dato que se borró no queda del intento anterior.
  Map<String, dynamic> toJson() => {
        'unitPrice': unitPrice,
        'unitCost': calc != null ? null : legacyUnitCost,
        'filamentId': calc?.filamentId,
        'material': calc?.material,
        'grams': calc?.grams,
        'printMinutes': calc?.printMinutes,
        'bulkPrice': bulkPrice,
        'bulkFrom': bulkFrom,
        'dimensions': _opt(dimensions),
        'colors': _opt(colors),
        'deliveryTime': _opt(deliveryTime),
        'note': _opt(note),
        'message': message == null ? null : _opt(message!),
      };
}

/// Qué mandar en `message` al guardar la respuesta: el texto solo si el
/// operador lo escribió o lo cambió a mano. Si quedó vacío, o igual al mensaje
/// ya guardado ([saved]), va `null` y el servidor lo arma de nuevo con los
/// números nuevos (si no, un cambio de precio dejaría el mensaje viejo).
String? messageToSend({required String typed, required String? saved}) {
  final t = typed.trim();
  if (t.isEmpty) return null;
  if (saved != null && t == saved.trim()) return null;
  return t;
}

/// Lo que dice el servidor cuando a la respuesta le falta el cálculo.
const missingCalcMessage = 'Calculá el precio con la calculadora: así queda guardado el costo del pedido.';

/// Validación de la respuesta (mismas reglas que `inquiryAnswerSchema`). Los
/// números llegan como texto, tal cual se tipearon (formato argentino).
Map<String, String> validateRespuestaForm({
  required String unitPrice,
  required bool hasCostBasis,
  required String bulkPrice,
  required String bulkFrom,
  PriceMode mode = PriceMode.unit,
  int quantity = 1,
  String dimensions = '',
  String colors = '',
  String deliveryTime = '',
  String note = '',
  String message = '',
}) {
  final errors = <String, String>{};
  final price = parseArNumber(unitPrice);
  if (unitPrice.trim().isEmpty) {
    errors['unitPrice'] =
        mode == PriceMode.total && quantity > 1 ? 'Poné el precio por las $quantity.' : 'Poné el precio por unidad.';
  } else if (price == null) {
    errors['unitPrice'] = 'No entiendo ese número. Ejemplo: 12.500';
  } else if (price <= 0) {
    errors['unitPrice'] = 'El precio tiene que ser mayor a 0.';
  }

  // El costo ya no se tipea: sale de la calculadora (o quedó de una respuesta
  // vieja). Mismo texto que el servidor (campo `calc`).
  if (!hasCostBasis) errors['calc'] = missingCalcMessage;

  final hasBulkPrice = bulkPrice.trim().isNotEmpty;
  final hasBulkFrom = bulkFrom.trim().isNotEmpty;
  if (hasBulkPrice) {
    final b = parseArNumber(bulkPrice);
    if (b == null) {
      errors['bulkPrice'] = 'No entiendo ese número. Ejemplo: 10.000';
    } else if (b <= 0) {
      errors['bulkPrice'] = 'El precio tiene que ser mayor a 0.';
    }
  }
  if (hasBulkFrom) {
    final n = int.tryParse(bulkFrom.trim());
    if (n == null || n < 2) {
      errors['bulkFrom'] = 'Mínimo 2 unidades.';
    } else if (n > 9999) {
      errors['bulkFrom'] = 'Máximo 9999 unidades.';
    }
  }
  // Van juntos o ninguno.
  if (hasBulkPrice && !hasBulkFrom) errors['bulkFrom'] = 'Poné desde cuántas unidades.';
  if (hasBulkFrom && !hasBulkPrice) errors['bulkPrice'] = 'Poné el precio por cantidad.';

  if (dimensions.trim().length > 300) errors['dimensions'] = 'Hasta 300 letras.';
  if (colors.trim().length > 300) errors['colors'] = 'Hasta 300 letras.';
  if (deliveryTime.trim().length > 120) errors['deliveryTime'] = 'Hasta 120 letras.';
  if (note.trim().length > 1000) errors['note'] = 'Hasta 1000 letras.';
  if (message.trim().length > 6000) errors['message'] = 'Hasta 6000 letras.';
  return errors;
}
