import { useEffect, useMemo, useState } from 'react'
import {
  BedDouble,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Edit3,
  Home,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
  Wifi,
  X
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '5490000000000'
const MAPS_EMBED_URL = import.meta.env.VITE_GOOGLE_MAPS_EMBED_URL || ''
const GOOGLE_REVIEWS_URL =
  import.meta.env.VITE_GOOGLE_REVIEWS_URL ||
  'https://www.google.com/maps/search/?api=1&query=ApartRinc%C3%B3n%20Alta%20Gracia%20C%C3%B3rdoba'
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL || ''

const fallbackProperties = [
  {
    id: 'depto-1',
    name: 'Departamento 1',
    short_description: 'Departamento por temporada en Alta Gracia, preparado para una estadía cómoda, tranquila y funcional.',
    description:
      'Unidad equipada para huéspedes que buscan descanso, limpieza, seguridad y atención cercana. Ideal para consultar disponibilidad de forma directa por WhatsApp.',
    capacity: 4,
    services: ['WiFi', 'Cocina equipada', 'Heladera', 'Ropa de cama', 'Aire / calefacción'],
    accessibility: ['Ingreso cómodo', 'Espacios funcionales'],
    images: [],
    active: true
  },
  {
    id: 'depto-2',
    name: 'Departamento 2',
    short_description: 'Opción confortable para viajes, descanso o estadías temporarias cerca de Alta Gracia.',
    description:
      'Departamento equipado con servicios esenciales, distribución práctica y comunicación directa para coordinar fechas, consultas y condiciones de estadía.',
    capacity: 3,
    services: ['WiFi', 'Cocina equipada', 'Baño privado', 'Ropa de cama', 'Atención por WhatsApp'],
    accessibility: ['Circulación simple', 'Ambientes prácticos'],
    images: [],
    active: true
  }
]

const comfortItems = [
  {
    icon: <Wifi size={24} />,
    title: 'Conectividad',
    text: 'Departamentos preparados para estadías temporarias, descanso y consultas online.'
  },
  {
    icon: <BedDouble size={24} />,
    title: 'Confort',
    text: 'Ambientes equipados, limpios y funcionales para estadías cortas o prolongadas.'
  },
  {
    icon: <DoorOpen size={24} />,
    title: 'Accesibilidad',
    text: 'Priorizamos espacios prácticos, seguros y fáciles de usar durante la estadía.'
  },
  {
    icon: <ShieldCheck size={24} />,
    title: 'Atención cercana',
    text: 'Comunicación directa para coordinar disponibilidad, llegada y detalles de la reserva.'
  }
]

function buildWhatsappUrl(propertyName = '') {
  const cleanNumber = String(WHATSAPP_NUMBER).replace(/\D/g, '')
  const text = encodeURIComponent(
    propertyName
      ? `Hola, quiero consultar disponibilidad para ${propertyName} en ApartRincón.\nFechas aproximadas:\nCantidad de personas:`
      : 'Hola, quiero consultar disponibilidad en ApartRincón.\nFechas aproximadas:\nCantidad de personas:'
  )

  if (!cleanNumber || cleanNumber === '5490000000000') {
    return '/contacto'
  }

  return `https://wa.me/${cleanNumber}?text=${text}`
}

function buildGuestWhatsappUrl(phone, propertyName = '') {
  const cleanNumber = String(phone || '').replace(/\D/g, '')

  if (!cleanNumber) return ''

  const text = encodeURIComponent(
    propertyName
      ? `Hola, te escribo desde ApartRincón por tu reserva/consulta de ${propertyName}.`
      : 'Hola, te escribo desde ApartRincón por tu reserva/consulta.'
  )

  return `https://wa.me/${cleanNumber}?text=${text}`
}

function resolveImageUrl(value) {
  if (!value) return ''
  if (value.startsWith('http')) return value
  if (value.startsWith('/uploads')) return `${API_URL}${value}`
  return value
}

function formatDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const bookingStatusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' }
]

const bookingFilters = [
  { value: 'active', label: 'Activas' },
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'reserved', label: 'Reservadas' },
  { value: 'blocked', label: 'Bloqueadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' }
]

function statusLabel(status) {
  const found = bookingStatusOptions.find((item) => item.value === status)
  return found?.label || status
}

function isBookingActive(status) {
  return !['completed', 'cancelled'].includes(status)
}

function Shell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    ['Inicio', '/'],
    ['Quiénes somos', '/quienes-somos'],
    ['Por qué elegirnos', '/por-que-elegirnos'],
    ['Servicios', '/servicios'],
    ['Propiedades', '/propiedades'],
    ['Galería', '/galeria'],
    ['Contacto', '/contacto']
  ]

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Ir al inicio">
          <img src="/images/logo.png" alt="Logo ApartRincón" />
          <span>ApartRincón</span>
        </a>

        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú">
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={menuOpen ? 'nav open' : 'nav'}>
          {navItems.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          
        </nav>
      </header>

      {children}

      <a
        className="floating-whatsapp"
        href={buildWhatsappUrl()}
        target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
        rel="noopener noreferrer"
        aria-label="Consultar por WhatsApp"
      >
        <MessageCircle size={24} />
      </a>
    </div>
  )
}

function useProperties() {
  const [properties, setProperties] = useState(fallbackProperties)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`${API_URL}/api/properties`)
        if (response.ok) {
          const data = await response.json()
          setProperties(data.length ? data : fallbackProperties)
        }
      } catch (error) {
        console.warn('Backend no disponible. Usando datos de respaldo.', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return { properties: properties.filter((property) => property.active !== false), loading }
}

function useGallery() {
  const [galleryImages, setGalleryImages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`${API_URL}/api/gallery`)
        if (response.ok) {
          const data = await response.json()
          setGalleryImages(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.warn('Galería general no disponible.', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return { galleryImages, loading }
}

function PageHero({ eyebrow, title, text, children }) {
  return (
    <section className="page-hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {children}
    </section>
  )
}

function HomePage() {
  const { properties, loading } = useProperties()

  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">Departamentos por temporada</p>
            <h1>Departamentos por temporada en Alta Gracia.</h1>
            <p className="hero-text">
              ApartRincón ofrece departamentos equipados para estadías temporarias en una zona tranquila, cerca de Alta Gracia,
              con atención directa y una experiencia simple desde la consulta hasta la reserva.
            </p>

            <div className="hero-actions">
              <a className="button primary" href="/propiedades">
                Ver propiedades <ChevronRight size={18} />
              </a>
              <a
                className="button secondary"
                href={buildWhatsappUrl()}
                target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                Consultar disponibilidad
              </a>
            </div>

            <div className="hero-metrics" aria-label="Características principales">
              <div>
                <strong>2</strong>
                <span>propiedades</span>
              </div>
              <div>
                <strong>Directa</strong>
                <span>atención por WhatsApp</span>
              </div>
              <div>
                <strong>Alta Gracia</strong>
                <span>Córdoba</span>
              </div>
            </div>
          </div>

          <div className="hero-brand-panel" aria-label="Presentación de marca ApartRincón">
            <div className="hero-brand-glow" />

            <img className="hero-brand-logo-clean" src="/images/logo.png" alt="ApartRincón" />

            <div className="hero-brand-info">
              <p>APART RINCÓN</p>
              <span>Alta Gracia · Córdoba</span>
            </div>

            <a
              className="availability-pill hero-whatsapp-pill"
              href={buildWhatsappUrl()}
              target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} />
              Consulta personalizada por WhatsApp
            </a>
          </div>
        </section>

        <section className="section split">
          <div>
            <p className="eyebrow">Quiénes somos</p>
            <h2>Una propuesta pensada para huéspedes que buscan comodidad, tranquilidad y atención cercana.</h2>
          </div>
          <div className="text-block">
            <p>
              ApartRincón ofrece departamentos por temporada en Alta Gracia, Córdoba, con una propuesta orientada al descanso,
              la comodidad y la atención cercana durante toda la estadía.
            </p>
            <a className="text-link" href="/quienes-somos">
              Conocer más <ChevronRight size={16} />
            </a>
          </div>
        </section>

        <FeaturedProperties properties={properties} loading={loading} />
        <ReviewsCarousel />
        <LocationSection />
        <ContactCTA />
      </main>
      <Footer />
    </Shell>
  )
}

function AboutPage() {
  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Quiénes somos"
          title="ApartRincón: estadías temporarias con atención directa."
          text="Conocé la propuesta de alojamiento temporario de ApartRincón en Alta Gracia, Córdoba."
        />

        <section className="section split">
          <div>
            <h2>Una propuesta cercana y funcional.</h2>
          </div>
          <div className="text-block">
            <p>
              ApartRincón nace como una alternativa de alojamiento temporario en Alta Gracia, Córdoba, enfocada en comodidad,
              limpieza, seguridad y buena comunicación antes y durante la estadía.
            </p>
            <p>
              La idea central es que cada huésped pueda ver las propiedades, revisar servicios y consultar por WhatsApp para recibir
              una respuesta personalizada según fechas, cantidad de personas y necesidades puntuales.
            </p>
          </div>
        </section>

        <section className="section values-grid">
          <InfoCard title="Atención humana" text="La disponibilidad, el precio y los detalles se conversan directamente por WhatsApp." />
          <InfoCard title="Estadías simples" text="La página está pensada para que el huésped encuentre información clara sin pasos innecesarios." />
          <InfoCard title="Confianza" text="La reputación de Google, las fotos reales y la ubicación ayudan a reducir dudas antes de consultar." />
        </section>
      </main>
      <Footer />
    </Shell>
  )
}

function WhyChooseUsPage() {
  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Por qué elegirnos"
          title="Comodidad, ubicación tranquila y trato personalizado."
          text="Elegí una estadía cómoda, tranquila y con comunicación directa para coordinar cada detalle."
        />

        <section className="section comfort-section">
          <div className="comfort-grid">
            <InfoCard title="Opiniones públicas" text="Las reseñas se consultan directamente en Google para mantener visible su fuente original." />
            <InfoCard title="Comunicación directa" text="Coordinás disponibilidad, fechas y detalles por WhatsApp con atención personalizada." />
            <InfoCard title="Espacios equipados" text="Las propiedades se presentan con servicios, capacidad, fotos y descripción clara." />
            <InfoCard title="Zona tranquila" text="Ubicación en km22 Valle Mitimay, Ruta 5, cerca de Alta Gracia, Córdoba." />
          </div>
        </section>

        <ReviewsCarousel />
      </main>
      <Footer />
    </Shell>
  )
}

function ServicesPage() {
  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Servicios"
          title="Servicios pensados para estadías temporarias."
          text="Conocé las comodidades y prestaciones principales disponibles para tu estadía."
        />

        <section className="section comfort-section">
          <div className="comfort-grid">
            {comfortItems.map((item) => (
              <article className="comfort-card" key={item.title}>
                <div className="icon-badge">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section service-list-section">
          <div className="section-heading align-left">
            <p className="eyebrow">Comodidades</p>
            <h2>Todo lo necesario para una estadía cómoda.</h2>
          </div>
          <div className="service-list">
            <span>WiFi</span>
            <span>Cocina equipada</span>
            <span>Heladera</span>
            <span>Ropa de cama</span>
            <span>Baño privado</span>
            <span>Aire / calefacción</span>
            <span>Espacio para descanso</span>
            <span>Consulta por WhatsApp</span>
          </div>
        </section>
      </main>
      <Footer />
    </Shell>
  )
}

function PropertiesPage() {
  const { properties, loading } = useProperties()

  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Catálogo"
          title="Propiedades disponibles para consulta."
          text="Consultá por WhatsApp para confirmar fechas, precio y detalles de cada propiedad."
        />
        <FeaturedProperties properties={properties} loading={loading} full />
      </main>
      <Footer />
    </Shell>
  )
}

function GalleryPage() {
  const { galleryImages, loading } = useGallery()

  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Galería"
          title="Galería de ApartRincón."
          text="Explorá imágenes de los departamentos, el entorno y los espacios pensados para disfrutar la estadía."
        />

        <section className="section gallery-section">
          {loading ? (
            <div className="loading-box">
              <Loader2 className="spin" />
              Cargando galería...
            </div>
          ) : galleryImages.length === 0 ? (
            <div className="empty-gallery">
              <Camera size={46} />
              <h2>Fotos próximamente</h2>
              <p>Pronto vas a encontrar imágenes de los departamentos, el entorno y los espacios de ApartRincón.</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {galleryImages.map((item, index) => (
                <article className="gallery-item" key={item.id || `${item.image_url}-${index}`}>
                  <img src={resolveImageUrl(item.image_url)} alt={item.title || `ApartRincón foto ${index + 1}`} />
                  <span>{item.title || 'ApartRincón'}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </Shell>
  )
}

function ContactPage() {
  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Contacto"
          title="Consultá disponibilidad por WhatsApp."
          text="Consultá fechas, tarifas, cantidad de huéspedes y detalles de la estadía por WhatsApp."
        >
          <a
            className="button primary large"
            href={buildWhatsappUrl()}
            target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            <MessageCircle size={20} />
            Hablar por WhatsApp
          </a>
        </PageHero>
        <p className="section contact-privacy-note">
          Al continuar por WhatsApp, ese servicio recibirá tu número y el mensaje que decidas enviar. ApartRincón
          usará los datos únicamente para responder y gestionar tu consulta o reserva. Leé nuestra{' '}
          <a href="/privacidad">Política de privacidad</a>.
        </p>
        <LocationSection />
      </main>
      <Footer />
    </Shell>
  )
}

function FeaturedProperties({ properties, loading, full = false }) {
  return (
    <section className="section properties-section">
      <div className="section-heading">
        <p className="eyebrow">Catálogo</p>
        <h2>{full ? 'Propiedades de ApartRincón.' : 'Propiedades disponibles para consulta.'}</h2>
        <p>
          Cada propiedad tiene consulta directa por WhatsApp. Podés revisar servicios, capacidad y fotos antes de escribirnos.
        </p>
      </div>

      {loading ? (
        <div className="loading-box">
          <Loader2 className="spin" />
          Cargando propiedades...
        </div>
      ) : (
        <div className="property-grid">
          {properties.map((property, index) => (
            <PropertyCard key={property.id} property={property} index={index} />
          ))}
        </div>
      )}
    </section>
  )
}

function PropertyCard({ property, index }) {
  const images = normalizeList(property.images)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const currentImage = images[currentImageIndex]
  const hasMultipleImages = images.length > 1

  function showPreviousImage() {
    if (!hasMultipleImages) return
    setCurrentImageIndex((current) => (current - 1 + images.length) % images.length)
  }

  function showNextImage() {
    if (!hasMultipleImages) return
    setCurrentImageIndex((current) => (current + 1) % images.length)
  }

  useEffect(() => {
    if (currentImageIndex > images.length - 1) {
      setCurrentImageIndex(0)
    }
  }, [currentImageIndex, images.length])

  return (
    <article className="property-card">
      <div className={`property-media property-slider media-${index}`}>
        {currentImage ? (
          <>
            <img src={resolveImageUrl(currentImage)} alt={`${property.name} foto ${currentImageIndex + 1}`} />

            {hasMultipleImages && (
              <>
                <button
                  className="property-slider-arrow previous"
                  type="button"
                  onClick={showPreviousImage}
                  aria-label={`Ver foto anterior de ${property.name}`}
                >
                  <ChevronLeft size={20} />
                </button>

                <button
                  className="property-slider-arrow next"
                  type="button"
                  onClick={showNextImage}
                  aria-label={`Ver foto siguiente de ${property.name}`}
                >
                  <ChevronRight size={20} />
                </button>

                <div className="property-slider-counter">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <span>Foto de la propiedad</span>
        )}
      </div>

      <div className="property-content">
        <div className="property-title-row">
          <h3>{property.name}</h3>
          <span className="capacity">
            <Users size={16} />
            Hasta {property.capacity} personas
          </span>
        </div>

        <p>{property.short_description || property.description}</p>

        <div className="tags">
          {(property.services || []).slice(0, 5).map((service) => (
            <span key={service}>
              <CheckCircle2 size={14} />
              {service}
            </span>
          ))}
        </div>

        <div className="property-actions">
          <a
            className="button primary"
            href={buildWhatsappUrl(property.name)}
            target={buildWhatsappUrl(property.name).startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} />
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </article>
  )
}

function ReviewsCarousel() {
  return (
    <section className="section reviews-section">
      <div className="section-heading">
        <p className="eyebrow">Fuente original</p>
        <h2>Opiniones públicas en Google.</h2>
        
      </div>

      <p className="placeholder-note">
        Para evitar testimonios desactualizados o sin una fuente comprobable, no reproducimos reseñas manualmente
        dentro del sitio. Podés ver autores, fechas y texto vigente directamente en Google.
      </p>
      <a className="button secondary centered" href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
        <Star size={18} />
        Ver reseñas en Google
      </a>
    </section>
  )
}

function LocationSection() {
  return (
    <section className="section location-section">
      <div className="location-copy">
        <p className="eyebrow">Ubicación</p>
        <h2>Ubicación en Alta Gracia, Córdoba.</h2>
        <p>
          ApartRincón se encuentra en km22 Valle Mitimay, Ruta 5, X5186 Alta Gracia, Córdoba. Los huéspedes
          pueden consultar la ubicación y organizar su llegada con facilidad.
        </p>
        <div className="location-items">
          <span>
            <MapPin size={18} />
            km22 Valle Mitimay, Ruta 5, X5186 Alta Gracia, Córdoba
          </span>
          <span>
            <Phone size={18} />
            03547 45-6045
          </span>
          {INSTAGRAM_URL && (
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
        </div>
      </div>

      <div className="map-card">
        {MAPS_EMBED_URL ? (
          <iframe
            title="Ubicación ApartRincón"
            src={MAPS_EMBED_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="map-placeholder">
            <MapPin size={42} />
            <strong>Mapa pendiente</strong>
            <span>El mapa estará disponible próximamente.</span>
          </div>
        )}
      </div>
    </section>
  )
}

function ContactCTA() {
  return (
    <section className="section contact-section">
      <div>
        <p className="eyebrow">Contacto</p>
        <h2>Consulta disponibilidad por WhatsApp.</h2>
        <p>
          El flujo principal recomendado es simple: el huésped ve la propiedad, consulta por WhatsApp y recibe una respuesta personalizada sobre fechas, precio y detalles.
        </p>
      </div>

      <a
        className="button primary large"
        href={buildWhatsappUrl()}
        target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
        rel="noopener noreferrer"
      >
        <MessageCircle size={20} />
        Hablar por WhatsApp
      </a>
    </section>
  )
}

function InfoCard({ title, text }) {
  return (
    <article className="comfort-card">
      <div className="icon-badge">
        <Sparkles size={22} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <img src="/images/logo.png" alt="ApartRincón" />
      <span>© {new Date().getFullYear()} ApartRincón. Departamentos por temporada.</span>
      <nav className="footer-links" aria-label="Información legal">
        <a href="/privacidad">Privacidad</a>
        <a href="/terminos">Términos</a>
      </nav>
    </footer>
  )
}

function PrivacyPage() {
  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Información legal"
          title="Política de privacidad."
          text="Versión vigente: 30 de agosto de 2026."
        />
        <article className="section legal-content">
          <section>
            <h2>Responsable y contacto</h2>
            <p>
              ApartRincón gestiona departamentos por temporada en km22 Valle Mitimay, Ruta 5, X5186 Alta Gracia,
              Córdoba, Argentina. Para consultas sobre datos personales o para ejercer derechos, comunicate al
              03547 45-6045 o mediante el WhatsApp oficial publicado en este sitio.
            </p>
          </section>
          <section>
            <h2>Qué datos tratamos y para qué</h2>
            <p>
              El sitio público muestra propiedades y no crea cuentas de huéspedes. Cuando nos contactás podemos
              registrar nombre, teléfono, fechas, propiedad consultada y notas necesarias para responder,
              coordinar una reserva, prestar la estadía y cumplir obligaciones legales. No vendemos estos datos.
            </p>
          </section>
          <section>
            <h2>Servicios de terceros</h2>
            <p>
              Al abrir WhatsApp, Instagram, Google Maps o Google Reviews, esos proveedores reciben los datos
              técnicos y el contenido que decidas enviar conforme a sus propias políticas. El alojamiento de la
              web y de la base operativa puede tratar datos solo para prestar infraestructura a ApartRincón.
            </p>
          </section>
          <section>
            <h2>Conservación y seguridad</h2>
            <p>
              Los datos operativos de una reserva se restringen al panel privado y se anonimizan automáticamente
              365 días después de finalizar la estadía. Podremos conservar constancias mínimas por plazos legales.
              Las fotos que sube la administración son públicas por su finalidad; al retirarlas del panel también
              se elimina el archivo local. Se aplican sesiones con vencimiento, validación de archivos y controles
              de acceso, aunque ningún sistema puede garantizar riesgo cero.
            </p>
          </section>
          <section>
            <h2>Cookies, inteligencia artificial y decisiones</h2>
            <p>
              El sitio público no usa cuentas, cookies de sesión propias ni decisiones automatizadas. ApartRincón
              no ofrece un asistente de IA ni usa IA para aceptar o rechazar reservas. Si estas prácticas cambian,
              esta política se actualizará antes de aplicar el nuevo tratamiento.
            </p>
          </section>
          <section>
            <h2>Tus derechos</h2>
            <p>
              Podés solicitar acceso, rectificación, actualización o supresión por los canales indicados. Una
              supresión puede limitarse cuando exista una obligación legal de conservación. También podés
              consultar o reclamar ante la Agencia de Acceso a la Información Pública de Argentina.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </Shell>
  )
}

function TermsPage() {
  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Información legal"
          title="Términos y condiciones."
          text="Versión vigente: 30 de agosto de 2026."
        />
        <article className="section legal-content">
          <section>
            <h2>Consultas y reservas</h2>
            <p>
              La información del sitio es descriptiva. Disponibilidad, tarifa final, cantidad de huéspedes,
              duración, servicios incluidos, ingreso y salida se confirman directamente por WhatsApp antes de
              reservar. Una consulta no bloquea fechas hasta que ApartRincón lo confirme expresamente.
            </p>
          </section>
          <section>
            <h2>Pagos, cambios y cancelaciones</h2>
            <p>
              El medio de pago, seña y saldo se informan antes de confirmar. Las condiciones particulares de
              cambio o cancelación se comunican de forma clara durante la reserva y se aplican respetando la Ley
              de Defensa del Consumidor y demás normas argentinas. Podés gestionar una cancelación por el mismo
              WhatsApp o teléfono usado para contratar, sin pasos artificialmente más difíciles.
            </p>
          </section>
          <section>
            <h2>Uso de la propiedad</h2>
            <p>
              La persona que reserva debe brindar datos correctos, respetar la capacidad acordada, las normas de
              convivencia y el cuidado de las instalaciones. Cualquier condición especial se informa y acepta
              antes de la estadía.
            </p>
          </section>
          <section>
            <h2>Sin renovaciones automáticas</h2>
            <p>
              ApartRincón ofrece estadías puntuales: no activa suscripciones, renovaciones automáticas ni cobros
              recurrentes. Toda extensión de una estadía requiere una nueva confirmación expresa de fechas y precio.
            </p>
          </section>
          <section>
            <h2>Reseñas y servicios externos</h2>
            <p>
              No reproducimos testimonios manualmente: las opiniones, sus autores y sus fechas se consultan en la
              fuente original de Google. WhatsApp, Google, Instagram y otros enlaces externos se rigen además por
              sus propias condiciones.
            </p>
          </section>
          <section>
            <h2>Privacidad, cambios y contacto</h2>
            <p>
              El tratamiento de datos se explica en la <a href="/privacidad">Política de privacidad</a>. Podemos
              actualizar estos términos indicando la nueva fecha. Para consultas, llamá al 03547 45-6045 o usá el
              WhatsApp oficial del sitio. Se aplica la legislación argentina y las protecciones irrenunciables de
              las personas consumidoras.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </Shell>
  )
}

function AdminApp() {
  const [token, setToken] = useState(sessionStorage.getItem('apart_admin_token') || '')
  const [loginData, setLoginData] = useState({ username: '', password: '' })
  const [properties, setProperties] = useState([])
  const [bookings, setBookings] = useState([])
  const [galleryImages, setGalleryImages] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCalendarProperty, setSelectedCalendarProperty] = useState('')
  const [editingBooking, setEditingBooking] = useState(null)
  const [bookingFilter, setBookingFilter] = useState('active')

  const [bookingForm, setBookingForm] = useState({
    property_id: '',
    guest_name: '',
    phone: '',
    start_date: '',
    end_date: '',
    status: 'reserved',
    notes: ''
  })

  async function adminFetch(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error desconocido' }))
      if (response.status === 401) {
        sessionStorage.removeItem('apart_admin_token')
        setToken('')
      }
      throw new Error(error.detail || 'Error de API')
    }

    return response.json()
  }

  async function login(event) {
    event.preventDefault()
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      })

      if (!response.ok) throw new Error('Credenciales inválidas')

      const data = await response.json()
      sessionStorage.setItem('apart_admin_token', data.access_token)
      localStorage.removeItem('apart_admin_token')
      setToken(data.access_token)
      setMessage('Sesión iniciada correctamente.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function loadAdminData() {
    if (!token) return

    try {
      const [propertyData, bookingData, galleryData] = await Promise.all([
        adminFetch('/api/admin/properties'),
        adminFetch('/api/admin/bookings'),
        adminFetch('/api/admin/gallery')
      ])
      setProperties(propertyData)
      setBookings(bookingData)
      setGalleryImages(galleryData)
      if (!bookingForm.property_id && propertyData[0]) {
        setBookingForm((current) => ({ ...current, property_id: propertyData[0].id }))
      }
      if (!selectedCalendarProperty && propertyData[0]) {
        setSelectedCalendarProperty(propertyData[0].id)
      }
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => {
    localStorage.removeItem('apart_admin_token')
    loadAdminData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function saveProperty(property) {
    setSaving(true)
    setMessage('')

    try {
      const payload = {
        ...property,
        services: normalizeList(property.services),
        accessibility: normalizeList(property.accessibility),
        images: normalizeList(property.images)
      }
      const updated = await adminFetch(`/api/admin/properties/${property.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      setProperties((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage('Propiedad actualizada.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadPropertyImage(propertyId, file) {
    if (!file) return
    setSaving(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_URL}/api/admin/properties/${propertyId}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Error subiendo imagen' }))
        throw new Error(error.detail || 'Error subiendo imagen')
      }

      const updated = await response.json()
      setProperties((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage('Imagen cargada en la propiedad.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadGalleryImage(file) {
    if (!file) return
    setSaving(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_URL}/api/admin/gallery/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Error subiendo imagen a galería' }))
        throw new Error(error.detail || 'Error subiendo imagen a galería')
      }

      await loadAdminData()
      setMessage('Imagen cargada en la galería general.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteGalleryImage(id) {
    if (!confirm('¿Eliminar esta imagen de la galería general?')) return
    setSaving(true)
    setMessage('')

    try {
      await adminFetch(`/api/admin/gallery/${id}`, { method: 'DELETE' })
      await loadAdminData()
      setMessage('Imagen eliminada de la galería general.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function createBooking(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      await adminFetch('/api/admin/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingForm)
      })
      setBookingForm({
        property_id: bookingForm.property_id,
        guest_name: '',
        phone: '',
        start_date: '',
        end_date: '',
        status: 'reserved',
        notes: ''
      })
      await loadAdminData()
      setMessage('Reserva, consulta o bloqueo creado.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateBooking(id, payload, successMessage = 'Reserva actualizada.') {
    setSaving(true)
    setMessage('')

    try {
      const updated = await adminFetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      setBookings((current) => current.map((item) => (item.id === id ? updated : item)))
      setMessage(successMessage)
      return updated
    } catch (error) {
      setMessage(error.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  function startEditingBooking(booking) {
    setEditingBooking({ ...booking })
  }

  function cancelEditingBooking() {
    setEditingBooking(null)
  }

  async function submitBookingEdit(event) {
    event.preventDefault()

    if (!editingBooking) return

    const updated = await updateBooking(
      editingBooking.id,
      {
        property_id: editingBooking.property_id,
        guest_name: editingBooking.guest_name || '',
        phone: editingBooking.phone || '',
        start_date: editingBooking.start_date,
        end_date: editingBooking.end_date,
        status: editingBooking.status,
        notes: editingBooking.notes || ''
      },
      'Reserva actualizada.'
    )

    if (updated) {
      setEditingBooking(null)
      await loadAdminData()
    }
  }

  async function updateBookingStatus(booking, status) {
    const updated = await updateBooking(
      booking.id,
      { status },
      `Reserva marcada como ${statusLabel(status).toLowerCase()}.`
    )

    if (updated) {
      await loadAdminData()
    }
  }

  async function deleteBooking(id) {
    if (!confirm('¿Eliminar definitivamente esta reserva/bloqueo? Esta acción debería usarse solo si fue cargada por error.')) return
    setSaving(true)

    try {
      await adminFetch(`/api/admin/bookings/${id}`, { method: 'DELETE' })
      await loadAdminData()
      setMessage('Reserva eliminada.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function purgeExpiredBookingData() {
    if (!confirm('¿Aplicar ahora la limpieza de datos personales de reservas vencidas?')) return
    setSaving(true)
    setMessage('')

    try {
      const result = await adminFetch('/api/admin/privacy/purge-bookings', { method: 'POST' })
      await loadAdminData()
      setMessage(`Privacidad aplicada: ${result.purged_bookings} reserva(s) anonimizada(s).`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  function logout() {
    sessionStorage.removeItem('apart_admin_token')
    localStorage.removeItem('apart_admin_token')
    setToken('')
    setProperties([])
    setBookings([])
    setGalleryImages([])
    setEditingBooking(null)
  }

  const filteredBookings = bookings.filter((booking) => {
    if (bookingFilter === 'all') return true
    if (bookingFilter === 'active') return isBookingActive(booking.status)
    return booking.status === bookingFilter
  })

  if (!token) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <img src="/images/logo.png" alt="ApartRincón" />
          <p className="eyebrow">Panel privado</p>
          <h1>Administración de agenda</h1>
          <p>Ingresa para editar propiedades, subir fotos y cargar reservas o bloqueos.</p>

          <form onSubmit={login} className="admin-form">
            <label>
              Usuario
              <input
                value={loginData.username}
                onChange={(event) => setLoginData({ ...loginData, username: event.target.value })}
                autoComplete="username"
                placeholder="Usuario administrador"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={loginData.password}
                onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                autoComplete="current-password"
                placeholder="Tu contraseña"
              />
            </label>
            <button className="button primary full" type="submit">
              <Lock size={18} />
              Entrar
            </button>
          </form>

          {message && <p className="admin-message">{message}</p>}

          <a className="back-link" href="/">
            Volver al sitio público
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <img src="/images/logo.png" alt="ApartRincón" />
        <h1>Admin</h1>
        <p>Gestión privada de propiedades, fotos y agenda.</p>
        <a href="/">Ver sitio público</a>
        <button className="button ghost full" onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">ApartRincón</p>
            <h2>Panel de administración</h2>
          </div>
          {saving && <span className="saving-label">Guardando...</span>}
        </header>

        {message && <p className="admin-message">{message}</p>}

        <section className="admin-section legal-admin-card">
          <div>
            <h3>Privacidad de huéspedes</h3>
            <p className="admin-help">
              Nombre, teléfono y notas se anonimizan automáticamente 365 días después de la salida. También podés
              ejecutar la limpieza manualmente.
            </p>
          </div>
          <button className="button ghost" type="button" onClick={purgeExpiredBookingData} disabled={saving}>
            <ShieldCheck size={18} />
            Limpiar datos vencidos
          </button>
        </section>

        <section className="admin-section">
          <h3>Agenda privada</h3>
          <p className="admin-help">
            Esta agenda solo se ve desde el admin. El visitante público no ve fechas reservadas, bloqueadas ni pendientes.
          </p>
          <AdminCalendar
            properties={properties}
            bookings={bookings}
            selectedProperty={selectedCalendarProperty}
            onSelectedProperty={setSelectedCalendarProperty}
          />
        </section>

        <section className="admin-section">
          <h3>Crear reserva, consulta o bloqueo</h3>
          <form className="booking-form" onSubmit={createBooking}>
            <label>
              Propiedad
              <select
                value={bookingForm.property_id}
                onChange={(event) => setBookingForm({ ...bookingForm, property_id: event.target.value })}
                required
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cliente
              <input
                value={bookingForm.guest_name}
                onChange={(event) => setBookingForm({ ...bookingForm, guest_name: event.target.value })}
                placeholder="Nombre del huésped"
              />
            </label>

            <label>
              Teléfono
              <input
                value={bookingForm.phone}
                onChange={(event) => setBookingForm({ ...bookingForm, phone: event.target.value })}
                placeholder="+54..."
              />
            </label>

            <label>
              Entrada
              <input
                type="date"
                value={bookingForm.start_date}
                onChange={(event) => setBookingForm({ ...bookingForm, start_date: event.target.value })}
                required
              />
            </label>

            <label>
              Salida
              <input
                type="date"
                value={bookingForm.end_date}
                onChange={(event) => setBookingForm({ ...bookingForm, end_date: event.target.value })}
                required
              />
            </label>

            <label>
              Estado
              <select
                value={bookingForm.status}
                onChange={(event) => setBookingForm({ ...bookingForm, status: event.target.value })}
              >
                {bookingStatusOptions
                  .filter((item) => ['pending', 'reserved', 'blocked'].includes(item.value))
                  .map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </label>

            <label className="wide">
              Notas internas
              <input
                value={bookingForm.notes}
                onChange={(event) => setBookingForm({ ...bookingForm, notes: event.target.value })}
                placeholder="Ej: señó 50%, llega por la tarde, consulta por mascota..."
              />
            </label>

            <button className="button primary" type="submit">
              <CalendarDays size={18} />
              Crear
            </button>
          </form>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <h3>Reservas cargadas</h3>
              <p className="admin-help">
                Actualiza el estado sin borrar historial. Usa eliminar solo cuando una reserva fue cargada por error.
              </p>
            </div>

            <div className="booking-filter-bar" aria-label="Filtrar reservas">
              {bookingFilters.map((filter) => (
                <button
                  key={filter.value}
                  className={bookingFilter === filter.value ? 'filter-button active' : 'filter-button'}
                  type="button"
                  onClick={() => setBookingFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-table">
            {bookings.length === 0 ? (
              <p>No hay reservas cargadas.</p>
            ) : filteredBookings.length === 0 ? (
              <p>No hay reservas para este filtro.</p>
            ) : (
              filteredBookings.map((booking) => {
                const property = properties.find((item) => item.id === booking.property_id)

                if (editingBooking?.id === booking.id) {
                  return (
                    <BookingEditForm
                      key={booking.id}
                      booking={editingBooking}
                      properties={properties}
                      onChange={setEditingBooking}
                      onCancel={cancelEditingBooking}
                      onSubmit={submitBookingEdit}
                    />
                  )
                }

                return (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    property={property}
                    onEdit={startEditingBooking}
                    onDelete={deleteBooking}
                    onStatusChange={updateBookingStatus}
                  />
                )
              })
            )}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <h3>Galería general</h3>
              <p className="admin-help">
                Usa esta sección para fotos del entorno, exteriores, alrededores o imágenes generales que no pertenecen a una propiedad específica.
              </p>
            </div>
            <label className="upload-label admin-upload-inline">
              <ImagePlus size={18} />
              Subir foto a galería general
              <input type="file" accept="image/*" onChange={(event) => uploadGalleryImage(event.target.files?.[0])} />
            </label>
          </div>

          {galleryImages.length === 0 ? (
            <p className="admin-help">Todavía no hay fotos en la galería general.</p>
          ) : (
            <div className="admin-image-grid">
              {galleryImages.map((item) => (
                <div className="admin-image-item" key={item.id}>
                  <img src={resolveImageUrl(item.image_url)} alt="Foto de galería general" />
                  <button type="button" onClick={() => deleteGalleryImage(item.id)} aria-label="Quitar imagen de galería">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-section">
          <h3>Editar propiedades</h3>
          <p className="admin-help">
            Usa esta sección solo para las fotos y datos propios de cada departamento. La primera imagen cargada en una propiedad se usa como foto principal de su tarjeta.
          </p>
          <div className="property-editor-grid">
            {properties.map((property) => (
              <PropertyEditor
                key={property.id}
                property={property}
                onChange={(updated) =>
                  setProperties((current) => current.map((item) => (item.id === property.id ? updated : item)))
                }
                onSave={() => saveProperty(property)}
                onUpload={(file) => uploadPropertyImage(property.id, file)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}


function BookingRow({ booking, property, onEdit, onDelete, onStatusChange }) {
  const guestWhatsapp = buildGuestWhatsappUrl(booking.phone, property?.name)

  return (
    <div className={`admin-row booking-row booking-${booking.status}`}>
      <div className="booking-summary">
        <div className="booking-title-line">
          <strong>{property?.name || booking.property_id}</strong>
          <span className={`status-badge ${booking.status}`}>{statusLabel(booking.status)}</span>
        </div>

        <span>
          {formatDate(booking.start_date)} al {formatDate(booking.end_date)}
        </span>

        <small>
          {booking.guest_name || 'Sin cliente'} {booking.phone ? `· ${booking.phone}` : ''}
        </small>

        {booking.notes && <small>{booking.notes}</small>}
      </div>

      <div className="booking-actions">
        <button className="button ghost compact" type="button" onClick={() => onEdit(booking)}>
          <Edit3 size={16} />
          Editar
        </button>

        {booking.status !== 'reserved' && (
          <button className="button secondary compact" type="button" onClick={() => onStatusChange(booking, 'reserved')}>
            Reservar
          </button>
        )}

        {booking.status !== 'pending' && (
          <button className="button ghost compact" type="button" onClick={() => onStatusChange(booking, 'pending')}>
            Pendiente
          </button>
        )}

        {booking.status !== 'completed' && (
          <button className="button ghost compact" type="button" onClick={() => onStatusChange(booking, 'completed')}>
            Completada
          </button>
        )}

        {booking.status !== 'cancelled' && (
          <button className="button ghost compact" type="button" onClick={() => onStatusChange(booking, 'cancelled')}>
            Cancelada
          </button>
        )}

        {guestWhatsapp && (
          <a className="button secondary compact" href={guestWhatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} />
            WhatsApp
          </a>
        )}

        <button className="icon-button danger" type="button" onClick={() => onDelete(booking.id)} title="Eliminar definitivamente">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}

function BookingEditForm({ booking, properties, onChange, onCancel, onSubmit }) {
  return (
    <form className="admin-row booking-edit-form" onSubmit={onSubmit}>
      <div className="booking-edit-grid">
        <label>
          Propiedad
          <select
            value={booking.property_id}
            onChange={(event) => onChange({ ...booking, property_id: event.target.value })}
            required
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Cliente
          <input
            value={booking.guest_name || ''}
            onChange={(event) => onChange({ ...booking, guest_name: event.target.value })}
            placeholder="Nombre del huésped"
          />
        </label>

        <label>
          Teléfono
          <input
            value={booking.phone || ''}
            onChange={(event) => onChange({ ...booking, phone: event.target.value })}
            placeholder="+54..."
          />
        </label>

        <label>
          Entrada
          <input
            type="date"
            value={booking.start_date || ''}
            onChange={(event) => onChange({ ...booking, start_date: event.target.value })}
            required
          />
        </label>

        <label>
          Salida
          <input
            type="date"
            value={booking.end_date || ''}
            onChange={(event) => onChange({ ...booking, end_date: event.target.value })}
            required
          />
        </label>

        <label>
          Estado
          <select value={booking.status} onChange={(event) => onChange({ ...booking, status: event.target.value })}>
            {bookingStatusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="wide">
          Notas internas
          <input
            value={booking.notes || ''}
            onChange={(event) => onChange({ ...booking, notes: event.target.value })}
            placeholder="Ej: señó 50%, llega por la tarde, consulta por mascota..."
          />
        </label>
      </div>

      <div className="booking-actions">
        <button className="button primary compact" type="submit">
          <CheckCircle2 size={16} />
          Guardar cambios
        </button>
        <button className="button ghost compact" type="button" onClick={onCancel}>
          <X size={16} />
          Cancelar
        </button>
      </div>
    </form>
  )
}

function AdminCalendar({ properties, bookings, selectedProperty, onSelectedProperty }) {
  const [month, setMonth] = useState(() => new Date())
  const selectedBookings = bookings.filter((booking) => booking.property_id === selectedProperty && booking.status !== 'cancelled')
  const calendarDays = buildCalendarDays(month)
  const monthLabel = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  function changeMonth(offset) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1))
  }

  return (
    <div className="calendar-panel">
      <div className="calendar-toolbar">
        <label>
          Propiedad
          <select value={selectedProperty} onChange={(event) => onSelectedProperty(event.target.value)}>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <div className="month-controls">
          <button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
            <ChevronLeft size={20} />
          </button>
          <strong>{capitalize(monthLabel)}</strong>
          <button className="icon-button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="calendar-legend">
        <span className="legend reserved">Reservado</span>
        <span className="legend blocked">Bloqueado</span>
        <span className="legend pending">Pendiente</span>
        <span className="legend completed">Completada</span>
        <span className="legend free">Libre</span>
      </div>

      <div className="calendar-grid">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
          <strong className="calendar-weekday" key={day}>{day}</strong>
        ))}
        {calendarDays.map((day, index) => {
          if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />

          const booking = selectedBookings.find((item) => isDateInsideBooking(day.iso, item))
          const className = booking ? `calendar-day ${booking.status}` : 'calendar-day free'

          return (
            <div className={className} key={day.iso}>
              <span>{day.dayNumber}</span>
              {booking ? <small>{statusLabel(booking.status)}</small> : <small>Libre</small>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PropertyEditor({ property, onChange, onSave, onUpload }) {
  const images = normalizeList(property.images)

  function removeImage(imageToRemove) {
    onChange({ ...property, images: images.filter((image) => image !== imageToRemove) })
  }

  return (
    <article className="property-editor">
      <div className="editor-title">
        <Home size={20} />
        <h4>{property.name}</h4>
      </div>

      <label>
        Nombre
        <input value={property.name || ''} onChange={(event) => onChange({ ...property, name: event.target.value })} />
      </label>

      <label>
        Descripción corta
        <input
          value={property.short_description || ''}
          onChange={(event) => onChange({ ...property, short_description: event.target.value })}
        />
      </label>

      <label>
        Descripción completa
        <textarea
          value={property.description || ''}
          onChange={(event) => onChange({ ...property, description: event.target.value })}
        />
      </label>

      <label>
        Capacidad
        <input
          type="number"
          value={property.capacity || 1}
          onChange={(event) => onChange({ ...property, capacity: Number(event.target.value) })}
        />
      </label>

      <label>
        Servicios separados por coma
        <input
          value={listToString(property.services)}
          onChange={(event) => onChange({ ...property, services: event.target.value })}
        />
      </label>

      <label>
        Accesibilidad separada por coma
        <input
          value={listToString(property.accessibility)}
          onChange={(event) => onChange({ ...property, accessibility: event.target.value })}
        />
      </label>

      <label>
        Fotos de esta propiedad por URL, separadas por coma
        <input
          value={listToString(property.images)}
          onChange={(event) => onChange({ ...property, images: event.target.value })}
          placeholder="/images/depto-1.jpg, https://..."
        />
      </label>

      <label className="upload-label">
        <ImagePlus size={18} />
        Subir foto a esta propiedad
        <input type="file" accept="image/*" onChange={(event) => onUpload(event.target.files?.[0])} />
      </label>

      {images.length > 0 && (
        <div className="admin-image-grid">
          {images.map((image) => (
            <div className="admin-image-item" key={image}>
              <img src={resolveImageUrl(image)} alt="Foto de propiedad" />
              <button type="button" onClick={() => removeImage(image)} aria-label="Quitar imagen">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={property.active !== false}
          onChange={(event) => onChange({ ...property, active: event.target.checked })}
        />
        Mostrar propiedad en el sitio
      </label>

      <button className="button secondary full" onClick={onSave}>
        <Edit3 size={18} />
        Guardar propiedad
      </button>
    </article>
  )
}

function buildCalendarDays(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const firstWeekdayMonday = (first.getDay() + 6) % 7
  const days = Array.from({ length: firstWeekdayMonday }, () => null)

  for (let day = 1; day <= last.getDate(); day += 1) {
    const current = new Date(year, month, day)
    days.push({
      dayNumber: day,
      iso: toISODate(current)
    })
  }

  return days
}

function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isDateInsideBooking(isoDate, booking) {
  return isoDate >= booking.start_date && isoDate < booking.end_date
}

function capitalize(value) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function listToString(value) {
  if (Array.isArray(value)) return value.join(', ')
  return value || ''
}

function normalizeList(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function PublicRouter() {
  const path = window.location.pathname

  if (path === '/quienes-somos') return <AboutPage />
  if (path === '/por-que-elegirnos') return <WhyChooseUsPage />
  if (path === '/servicios') return <ServicesPage />
  if (path === '/propiedades') return <PropertiesPage />
  if (path === '/galeria') return <GalleryPage />
  if (path === '/contacto') return <ContactPage />
  if (path === '/privacidad') return <PrivacyPage />
  if (path === '/terminos') return <TermsPage />

  return <HomePage />
}

function App() {
  const isAdmin = useMemo(() => window.location.pathname.startsWith('/admin'), [])

  return isAdmin ? <AdminApp /> : <PublicRouter />
}

export default App
