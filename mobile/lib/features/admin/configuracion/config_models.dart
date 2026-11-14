// Modelos de Configuración (`/api/v1/admin/configuracion`). Parseo defensivo:
// los numeric de Postgres pueden llegar como String, los textos como null y
// las listas faltar.

String _s(Object? v) => v == null ? '' : '$v';

String? _sn(Object? v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

double _d(Object? v, [double fallback = 0]) =>
    v is num ? v.toDouble() : double.tryParse('${v ?? ''}'.replaceAll(',', '.')) ?? fallback;

int _i(Object? v, [int fallback = 0]) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? fallback;

bool _b(Object? v, [bool fallback = false]) => v is bool ? v : fallback;

List<Map<String, dynamic>> _maps(Object? v) => [
      if (v is List)
        for (final e in v)
          if (e is Map) Map<String, dynamic>.from(e),
    ];

Map<String, dynamic> _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

// --- Negocio ---

/// Un turno del horario (mañana o tarde).
class HourShift {
  const HourShift({this.on = false, this.from = '', this.to = ''});
  final bool on;
  final String from;
  final String to;

  factory HourShift.fromJson(Object? j) {
    final m = _map(j);
    return HourShift(on: _b(m['on']), from: _s(m['from']), to: _s(m['to']));
  }

  HourShift copyWith({bool? on, String? from, String? to}) =>
      HourShift(on: on ?? this.on, from: from ?? this.from, to: to ?? this.to);

  Map<String, dynamic> toJson() => {'on': on, 'from': from, 'to': to};
}

/// Un renglón del horario de atención ("Lun a Vie", "Sábados"…).
class HourRow {
  const HourRow({required this.label, this.morning = const HourShift(), this.afternoon = const HourShift()});
  final String label;
  final HourShift morning;
  final HourShift afternoon;

  bool get closed => !morning.on && !afternoon.on;

  factory HourRow.fromJson(Map<String, dynamic> j) => HourRow(
        label: _s(j['label']),
        morning: HourShift.fromJson(j['morning']),
        afternoon: HourShift.fromJson(j['afternoon']),
      );

  HourRow copyWith({String? label, HourShift? morning, HourShift? afternoon}) => HourRow(
        label: label ?? this.label,
        morning: morning ?? this.morning,
        afternoon: afternoon ?? this.afternoon,
      );

  Map<String, dynamic> toJson() => {
        'label': label.trim(),
        'morning': morning.toJson(),
        'afternoon': afternoon.toJson(),
      };
}

class NegocioConfig {
  const NegocioConfig({
    this.storeName = '',
    this.slogan = '',
    this.description = '',
    this.whatsapp = '',
    this.contactEmail = '',
    this.addressText = '',
    this.instagram = '',
    this.tiktok = '',
    this.cuit = '',
    this.hours = const [],
  });

  final String storeName;
  final String slogan;
  final String description;
  final String whatsapp;
  final String contactEmail;
  final String addressText;
  final String instagram;
  final String tiktok;
  final String cuit;
  final List<HourRow> hours;

  factory NegocioConfig.fromJson(Map<String, dynamic> j) => NegocioConfig(
        storeName: _s(j['storeName']),
        slogan: _s(j['slogan']),
        description: _s(j['description']),
        whatsapp: _s(j['whatsapp']),
        contactEmail: _s(j['contactEmail']),
        addressText: _s(j['addressText']),
        instagram: _s(j['instagram']),
        tiktok: _s(j['tiktok']),
        cuit: _s(j['cuit']),
        hours: [for (final h in _maps(j['hours'])) HourRow.fromJson(h)],
      );
}

// --- Envíos ---

class ShippingZone {
  const ShippingZone({required this.name, required this.price});
  final String name;
  final double price;

  factory ShippingZone.fromJson(Map<String, dynamic> j) =>
      ShippingZone(name: _s(j['name']), price: _d(j['price']));
}

class EnviosConfig {
  const EnviosConfig({
    this.city = '',
    this.freeOver = 0,
    this.outMsg = '',
    this.zones = const [],
    this.pickupEnabled = true,
    this.deliveryEnabled = true,
  });

  final String city;
  final double freeOver;
  final String outMsg;
  final List<ShippingZone> zones;
  final bool pickupEnabled;
  final bool deliveryEnabled;

  factory EnviosConfig.fromJson(Map<String, dynamic> j) => EnviosConfig(
        city: _s(j['city']),
        freeOver: _d(j['freeOver']),
        outMsg: _s(j['outMsg']),
        zones: [for (final z in _maps(j['zones'])) ShippingZone.fromJson(z)],
        pickupEnabled: _b(j['pickupEnabled'], true),
        deliveryEnabled: _b(j['deliveryEnabled'], true),
      );
}

// --- Pagos ---

class PagosConfig {
  const PagosConfig({
    this.transferEnabled = true,
    this.transferAlias = '',
    this.transferCbu = '',
    this.mpEnabled = true,
    this.mpNote = '',
    this.mpConnected = false,
    this.cashEnabled = true,
    this.cashNote = '',
  });

  final bool transferEnabled;
  final String transferAlias;
  final String transferCbu;
  final bool mpEnabled;
  final String mpNote;

  /// MercadoPago tiene token cargado. El token en sí nunca llega al celular.
  final bool mpConnected;
  final bool cashEnabled;
  final String cashNote;

  factory PagosConfig.fromJson(Map<String, dynamic> j) => PagosConfig(
        transferEnabled: _b(j['transferEnabled'], true),
        transferAlias: _s(j['transferAlias']),
        transferCbu: _s(j['transferCbu']),
        mpEnabled: _b(j['mpEnabled'], true),
        mpNote: _s(j['mpNote']),
        mpConnected: _b(j['mpConnected']),
        cashEnabled: _b(j['cashEnabled'], true),
        cashNote: _s(j['cashNote']),
      );

  /// Medios que están activos hoy, para el resumen.
  List<String> get enabledNames => [
        if (transferEnabled) 'Transferencia',
        if (mpEnabled) 'MercadoPago',
        if (cashEnabled) 'Efectivo',
      ];
}

// --- Tienda ---

class BannerInfo {
  const BannerInfo({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.position = '50% 50%',
    this.align = 'left',
    this.ctaText,
    this.ctaHref,
    this.isActive = true,
    this.sortOrder = 0,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final String position;
  final String align;
  final String? ctaText;
  final String? ctaHref;
  final bool isActive;
  final int sortOrder;

  factory BannerInfo.fromJson(Map<String, dynamic> j) => BannerInfo(
        id: _s(j['id']),
        title: _s(j['title']),
        subtitle: _sn(j['subtitle']),
        imageUrl: _sn(j['imageUrl']),
        position: _sn(j['position']) ?? '50% 50%',
        align: _sn(j['align']) ?? 'left',
        ctaText: _sn(j['ctaText']),
        ctaHref: _sn(j['ctaHref']),
        isActive: _b(j['isActive'], true),
        sortOrder: _i(j['sortOrder']),
      );
}

/// Una temporada / campaña que se puede activar.
class SeasonOption {
  const SeasonOption({
    required this.key,
    required this.label,
    this.hint = '',
    this.accent = '#C9A84C',
    this.hasDeco = false,
  });

  final String key;
  final String label;
  final String hint;
  final String accent;
  final bool hasDeco;

  factory SeasonOption.fromJson(Map<String, dynamic> j) => SeasonOption(
        key: _s(j['key']),
        label: _s(j['label']),
        hint: _s(j['hint']),
        accent: _sn(j['accent']) ?? '#C9A84C',
        hasDeco: _b(j['hasDeco']),
      );
}

class HomeSectionToggle {
  const HomeSectionToggle({required this.id, required this.label, required this.on});
  final String id;
  final String label;
  final bool on;

  factory HomeSectionToggle.fromJson(Map<String, dynamic> j) =>
      HomeSectionToggle(id: _s(j['id']), label: _s(j['label']), on: _b(j['on'], true));
}

class TiendaConfig {
  const TiendaConfig({
    this.businessMode = 'checkout',
    this.accentColor,
    this.season = 'none',
    this.seasonDeco = false,
    this.seasonIntensity = 16,
    this.seasonDurationSec = 0,
    this.bannerIntervalSec = 5,
    this.logoUrl,
    this.heroImageUrl,
    this.homeSections = const [],
    this.seasons = const [],
    this.banners = const [],
  });

  /// `checkout` (vende online) o `vidriera` (catálogo que manda a WhatsApp).
  final String businessMode;
  final String? accentColor;
  final String season;
  final bool seasonDeco;
  final int seasonIntensity;
  final int seasonDurationSec;
  final int bannerIntervalSec;
  final String? logoUrl;
  final String? heroImageUrl;
  final List<HomeSectionToggle> homeSections;
  final List<SeasonOption> seasons;
  final List<BannerInfo> banners;

  bool get isVidriera => businessMode == 'vidriera';

  factory TiendaConfig.fromJson(Map<String, dynamic> j) => TiendaConfig(
        businessMode: j['businessMode'] == 'vidriera' ? 'vidriera' : 'checkout',
        accentColor: _sn(j['accentColor']),
        season: _sn(j['season']) ?? 'none',
        seasonDeco: _b(j['seasonDeco']),
        seasonIntensity: _i(j['seasonIntensity'], 16),
        seasonDurationSec: _i(j['seasonDurationSec']),
        bannerIntervalSec: _i(j['bannerIntervalSec'], 5),
        logoUrl: _sn(j['logoUrl']),
        heroImageUrl: _sn(j['heroImageUrl']),
        homeSections: [for (final s in _maps(j['homeSections'])) HomeSectionToggle.fromJson(s)],
        seasons: [for (final s in _maps(j['seasons'])) SeasonOption.fromJson(s)],
        banners: [for (final b in _maps(j['banners'])) BannerInfo.fromJson(b)],
      );
}

// --- Textos ---

class TrustItem {
  const TrustItem({required this.ic, required this.t, required this.d});
  final String ic;
  final String t;
  final String d;

  factory TrustItem.fromJson(Map<String, dynamic> j) => TrustItem(ic: _s(j['ic']), t: _s(j['t']), d: _s(j['d']));

  Map<String, dynamic> toJson() => {'ic': ic, 't': t.trim(), 'd': d.trim()};
}

class FaqItem {
  const FaqItem({required this.q, required this.a});
  final String q;
  final String a;

  factory FaqItem.fromJson(Map<String, dynamic> j) => FaqItem(q: _s(j['q']), a: _s(j['a']));

  Map<String, dynamic> toJson() => {'q': q.trim(), 'a': a.trim()};
}

class QuoteConfig {
  const QuoteConfig({
    this.title = '',
    this.depositPct = 50,
    this.depositText = '',
    this.notes = const [],
  });

  final String title;
  final int depositPct;
  final String depositText;
  final List<String> notes;

  factory QuoteConfig.fromJson(Map<String, dynamic> j) => QuoteConfig(
        title: _s(j['title']),
        depositPct: _i(j['depositPct'], 50),
        depositText: _s(j['depositText']),
        notes: [
          if (j['notes'] is List)
            for (final n in j['notes'] as List)
              if (n != null) '$n',
        ],
      );
}

class TextosConfig {
  const TextosConfig({
    this.trustBar = const [],
    this.trustBarCustom = false,
    this.faq = const [],
    this.faqCustom = false,
    this.quote = const QuoteConfig(),
  });

  final List<TrustItem> trustBar;
  final bool trustBarCustom;
  final List<FaqItem> faq;
  final bool faqCustom;
  final QuoteConfig quote;

  factory TextosConfig.fromJson(Map<String, dynamic> j) => TextosConfig(
        trustBar: [for (final t in _maps(j['trustBar'])) TrustItem.fromJson(t)],
        trustBarCustom: _b(j['trustBarCustom']),
        faq: [for (final f in _maps(j['faq'])) FaqItem.fromJson(f)],
        faqCustom: _b(j['faqCustom']),
        quote: QuoteConfig.fromJson(_map(j['quote'])),
      );
}

/// Toda la configuración (lo que devuelve `GET /admin/configuracion`).
class AdminConfig {
  const AdminConfig({
    this.negocio = const NegocioConfig(),
    this.envios = const EnviosConfig(),
    this.pagos = const PagosConfig(),
    this.tienda = const TiendaConfig(),
    this.textos = const TextosConfig(),
  });

  final NegocioConfig negocio;
  final EnviosConfig envios;
  final PagosConfig pagos;
  final TiendaConfig tienda;
  final TextosConfig textos;

  factory AdminConfig.fromJson(Map<String, dynamic> j) => AdminConfig(
        negocio: NegocioConfig.fromJson(_map(j['negocio'])),
        envios: EnviosConfig.fromJson(_map(j['envios'])),
        pagos: PagosConfig.fromJson(_map(j['pagos'])),
        tienda: TiendaConfig.fromJson(_map(j['tienda'])),
        textos: TextosConfig.fromJson(_map(j['textos'])),
      );
}

// --- Equipo y roles ---

class TeamMemberInfo {
  const TeamMemberInfo({
    required this.id,
    this.fullName,
    this.email,
    this.role = 'operator',
    this.roleId,
    this.roleName,
    this.pending = false,
    this.isSelf = false,
    this.isLastAdmin = false,
  });

  final String id;
  final String? fullName;
  final String? email;

  /// Rol de acceso: `admin` u `operator`.
  final String role;
  final String? roleId;
  final String? roleName;

  /// Invitación pendiente: todavía no creó su contraseña.
  final bool pending;
  final bool isSelf;
  final bool isLastAdmin;

  bool get isAdmin => role == 'admin';

  /// Nombre para mostrar: el nombre cargado o el mail.
  String get displayName => fullName ?? email ?? 'Sin nombre';

  String get roleLabel => roleName ?? (isAdmin ? 'Administrador' : 'Operador');

  factory TeamMemberInfo.fromJson(Map<String, dynamic> j) => TeamMemberInfo(
        id: _s(j['id']),
        fullName: _sn(j['fullName']),
        email: _sn(j['email']),
        role: j['role'] == 'admin' ? 'admin' : 'operator',
        roleId: _sn(j['roleId']),
        roleName: _sn(j['roleName']),
        pending: j['status'] == 'invitado',
        isSelf: _b(j['isSelf']),
        isLastAdmin: _b(j['isLastAdmin']),
      );
}

class RoleInfo {
  const RoleInfo({
    required this.id,
    required this.name,
    this.isSystem = false,
    this.isAdmin = false,
    this.permissions = const {},
    this.memberCount = 0,
  });

  final String id;
  final String name;

  /// Rol base (Administrador / Operador): no se borra.
  final bool isSystem;

  /// Acceso total: ignora la matriz y no se edita.
  final bool isAdmin;

  /// módulo → acciones (`ver`, `crear`, `editar`, `eliminar`).
  final Map<String, Set<String>> permissions;
  final int memberCount;

  bool allows(String module, String action) => isAdmin || (permissions[module]?.contains(action) ?? false);

  /// Cuántos módulos puede ver.
  int get visibleModules => permissions.values.where((a) => a.contains('ver')).length;

  factory RoleInfo.fromJson(Map<String, dynamic> j) {
    final raw = _map(j['permissions']);
    return RoleInfo(
      id: _s(j['id']),
      name: _s(j['name']),
      isSystem: _b(j['isSystem']),
      isAdmin: _b(j['isAdmin']),
      permissions: {
        for (final e in raw.entries)
          e.key: {
            if (e.value is List)
              for (final a in e.value as List) '$a',
          },
      },
      memberCount: _i(j['memberCount']),
    );
  }
}

class PermModuleInfo {
  const PermModuleInfo({required this.key, required this.label});
  final String key;
  final String label;
}

class TeamData {
  const TeamData({
    this.canManage = false,
    this.team = const [],
    this.roles = const [],
    this.modules = const [],
  });

  /// Quien consulta es administrador (puede invitar, cambiar roles, etc.).
  final bool canManage;
  final List<TeamMemberInfo> team;
  final List<RoleInfo> roles;
  final List<PermModuleInfo> modules;

  int get activeCount => team.where((t) => !t.pending).length;
  int get pendingCount => team.where((t) => t.pending).length;

  factory TeamData.fromJson(Map<String, dynamic> j) => TeamData(
        canManage: _b(j['canManage']),
        team: [for (final t in _maps(j['team'])) TeamMemberInfo.fromJson(t)],
        roles: [for (final r in _maps(j['roles'])) RoleInfo.fromJson(r)],
        modules: [
          for (final m in _maps(j['modules'])) PermModuleInfo(key: _s(m['key']), label: _s(m['label'])),
        ],
      );
}
