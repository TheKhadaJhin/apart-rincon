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
const GOOGLE_REVIEWS_URL = import.meta.env.VITE_GOOGLE_REVIEWS_URL || ''
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

const reviews = [
  {
    text: 'Departamento hermoso, totalmente equipado y muy cómodo. La ubicación es tranquila y está cerca de Alta Gracia.',
    author: 'Marcela Freitas',
    source: 'Google'
  },
  {
    text: 'Nos alojamos en el departamento más grande y quedamos encantados. Espacioso, seguro, luminoso y cerca de todo.',
    author: 'Carolina Tazzioli',
    source: 'Google'
  },
  {
    text: 'Muy lindo departamento, limpio y con dueños siempre atentos a lo que necesitábamos. Muy recomendable.',
    author: 'Ezequiel K',
    source: 'Google'
  },
  {
    text: 'Excelente atención, espacios cuidados y todo lo necesario para una estadía confortable.',
    author: 'Huésped de ApartRincón',
    source: 'Google'
  },
  {
    text: 'Muy buena experiencia. Se destaca la tranquilidad del lugar, la limpieza y la comunicación clara.',
    author: 'Reseña destacada',
    source: 'Google'
  },
  {
    text: 'Lugar cómodo para descansar, con detalles pensados para que el huésped se sienta bien recibido.',
    author: 'Experiencia de huésped',
    source: 'Google'
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

function statusLabel(status) {
  const labels = {
    reserved: 'Reservado',
    blocked: 'Bloqueado',
    pending: 'Pendiente'
  }
  return labels[status] || status
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
          <img src="/images/logo.jpeg" alt="Logo ApartRincón" />
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
          <a className="nav-admin" href="/admin">
            Admin
          </a>
        </nav>
      </header>

      {children}

      <a
        className="floating-whatsapp"
        href={buildWhatsappUrl()}
        target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
        rel="noreferrer"
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
                rel="noreferrer"
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
                <strong>5.0</strong>
                <span>calificación Google</span>
              </div>
              <div>
                <strong>38</strong>
                <span>reseñas</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <img src="/images/logo.jpeg" alt="ApartRincón" />
            <div className="availability-pill">
              <MessageCircle size={18} />
              Consulta personalizada por WhatsApp
            </div>
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
        <PrivateAvailabilityNotice />
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
          text="Una página independiente para presentar la marca, su forma de atención y el tipo de experiencia que busca entregar a cada huésped."
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
          text="Esta sección está preparada para reforzar argumentos comerciales antes de que el visitante consulte por WhatsApp."
        />

        <section className="section comfort-section">
          <div className="comfort-grid">
            <InfoCard title="Calificación 5.0" text="ApartRincón cuenta con una base de reseñas positiva en Google, útil para generar confianza inmediata." />
            <InfoCard title="Comunicación directa" text="El cliente no reserva automáticamente: consulta, conversa detalles y recibe información personalizada." />
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
          text="La sección puede ajustarse luego con los servicios exactos de cada propiedad."
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
            <p className="eyebrow">Base editable</p>
            <h2>Servicios a confirmar con fotos y datos reales.</h2>
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
          text="La disponibilidad real no se muestra públicamente. El cliente consulta por WhatsApp y la administración registra la reserva desde el panel privado."
        />
        <FeaturedProperties properties={properties} loading={loading} full />
        <PrivateAvailabilityNotice />
      </main>
      <Footer />
    </Shell>
  )
}

function GalleryPage() {
  const { properties, loading } = useProperties()
  const images = properties.flatMap((property) =>
    (property.images || []).map((image, index) => ({ property, image, index }))
  )

  return (
    <Shell>
      <main>
        <PageHero
          eyebrow="Galería"
          title="Fotos de las propiedades."
          text="Las fotos se cargan desde el panel admin. Cada propiedad puede tener múltiples imágenes para que el visitante las revise libremente."
        />

        <section className="section gallery-section">
          {loading ? (
            <div className="loading-box">
              <Loader2 className="spin" />
              Cargando galería...
            </div>
          ) : images.length === 0 ? (
            <div className="empty-gallery">
              <Camera size={46} />
              <h2>Galería preparada</h2>
              <p>Cuando cargues fotos desde el panel admin, aparecerán automáticamente en esta página.</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {images.map(({ property, image, index }) => (
                <article className="gallery-item" key={`${property.id}-${image}-${index}`}>
                  <img src={resolveImageUrl(image)} alt={`${property.name} foto ${index + 1}`} />
                  <span>{property.name}</span>
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
          text="El flujo recomendado es mantener la conversación directa: fechas, precio, cantidad de huéspedes y detalles se coordinan antes de registrar la reserva."
        >
          <a
            className="button primary large"
            href={buildWhatsappUrl()}
            target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
          >
            <MessageCircle size={20} />
            Hablar por WhatsApp
          </a>
        </PageHero>
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
          Cada propiedad tiene consulta directa por WhatsApp. La agenda de reservas queda privada para administración interna.
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
  const image = property.images?.[0]

  return (
    <article className="property-card">
      <div className={`property-media media-${index}`}>
        {image ? <img src={resolveImageUrl(image)} alt={property.name} /> : <span>Foto de la propiedad</span>}
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
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            Consultar por WhatsApp
          </a>
          <a className="button ghost" href="/galeria">
            Ver fotos
          </a>
        </div>
      </div>
    </article>
  )
}

function PrivateAvailabilityNotice() {
  return (
    <section className="section private-agenda-section">
      <div className="private-agenda-card">
        <div>
          <p className="eyebrow">Disponibilidad</p>
          <h2>La agenda de reservas es privada.</h2>
          <p>
            Para cuidar la conversación comercial, el visitante no ve días libres u ocupados. Consulta por WhatsApp y la administración
            confirma disponibilidad, precio y condiciones de estadía.
          </p>
        </div>
        <a
          className="button secondary"
          href={buildWhatsappUrl()}
          target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
        >
          Consultar fechas
        </a>
      </div>
    </section>
  )
}

function ReviewsCarousel() {
  const pageSize = 3
  const totalPages = Math.ceil(reviews.length / pageSize)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPage((current) => (current + 1) % totalPages)
    }, 7000)
    return () => clearInterval(timer)
  }, [totalPages])

  const visibleReviews = reviews.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <section className="section reviews-section">
      <div className="section-heading">
        <p className="eyebrow">Reseñas de Google</p>
        <h2>Experiencias de huéspedes.</h2>
        <p>Slider preparado para mostrar 3 reseñas por vez y avanzar a otras 3 de forma manual o automática.</p>
      </div>

      <div className="reviews-toolbar">
        <div className="rating-pill">
          <Star size={18} fill="currentColor" />
          5.0 · 38 reseñas
        </div>
        <div className="review-controls">
          <button className="icon-button" onClick={() => setPage((page - 1 + totalPages) % totalPages)} aria-label="Reseñas anteriores">
            <ChevronLeft size={20} />
          </button>
          <button className="icon-button" onClick={() => setPage((page + 1) % totalPages)} aria-label="Reseñas siguientes">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="review-grid">
        {visibleReviews.map((item) => (
          <article className="review-card" key={`${item.author}-${item.text}`}>
            <div className="stars" aria-label="5 estrellas">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} size={18} fill="currentColor" />
              ))}
            </div>
            <p>“{item.text}”</p>
            <strong>{item.author}</strong>
            <small>{item.source}</small>
          </article>
        ))}
      </div>

      <div className="review-dots" aria-label="Páginas de reseñas">
        {Array.from({ length: totalPages }).map((_, index) => (
          <button
            key={index}
            className={index === page ? 'active' : ''}
            onClick={() => setPage(index)}
            aria-label={`Ir a grupo de reseñas ${index + 1}`}
          />
        ))}
      </div>

      {GOOGLE_REVIEWS_URL ? (
        <a className="button secondary centered" href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer">
          Ver reseñas en Google
        </a>
      ) : (
        <p className="placeholder-note">Pendiente: agregar link real de reseñas de Google en el archivo .env.</p>
      )}
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
          ApartRincón se encuentra en km22 Valle Mitimay, Ruta 5, X5186 Alta Gracia, Córdoba. Desde esta sección los huéspedes
          pueden ubicarse y calcular su recorrido.
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
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
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
            <span>Configura VITE_GOOGLE_MAPS_EMBED_URL en frontend/.env</span>
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
          El flujo principal recomendado es simple: el huésped ve la propiedad, consulta por WhatsApp y el administrador confirma disponibilidad desde la agenda privada.
        </p>
      </div>

      <a
        className="button primary large"
        href={buildWhatsappUrl()}
        target={buildWhatsappUrl().startsWith('http') ? '_blank' : undefined}
        rel="noreferrer"
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
      <img src="/images/logo.jpeg" alt="ApartRincón" />
      <span>© {new Date().getFullYear()} ApartRincón. Departamentos por temporada.</span>
    </footer>
  )
}

function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem('apart_admin_token') || '')
  const [loginData, setLoginData] = useState({ username: 'admin@apartrincon.com', password: '' })
  const [properties, setProperties] = useState([])
  const [bookings, setBookings] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCalendarProperty, setSelectedCalendarProperty] = useState('')

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
      localStorage.setItem('apart_admin_token', data.access_token)
      setToken(data.access_token)
      setMessage('Sesión iniciada correctamente.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function loadAdminData() {
    if (!token) return

    try {
      const [propertyData, bookingData] = await Promise.all([
        adminFetch('/api/admin/properties'),
        adminFetch('/api/admin/bookings')
      ])
      setProperties(propertyData)
      setBookings(bookingData)
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
      setMessage('Imagen cargada.')
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
      setMessage('Reserva o bloqueo creado.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteBooking(id) {
    if (!confirm('¿Eliminar esta reserva/bloqueo?')) return
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

  function logout() {
    localStorage.removeItem('apart_admin_token')
    setToken('')
    setProperties([])
    setBookings([])
  }

  if (!token) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <img src="/images/logo.jpeg" alt="ApartRincón" />
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
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={loginData.password}
                onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                autoComplete="current-password"
                placeholder="cambiar123"
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
        <img src="/images/logo.jpeg" alt="ApartRincón" />
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
          <h3>Crear reserva o bloqueo</h3>
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
                <option value="reserved">Reservado</option>
                <option value="blocked">Bloqueado</option>
                <option value="pending">Pendiente</option>
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
          <h3>Reservas cargadas</h3>
          <div className="admin-table">
            {bookings.length === 0 ? (
              <p>No hay reservas cargadas.</p>
            ) : (
              bookings.map((booking) => {
                const property = properties.find((item) => item.id === booking.property_id)

                return (
                  <div className="admin-row" key={booking.id}>
                    <div>
                      <strong>{property?.name || booking.property_id}</strong>
                      <span>
                        {formatDate(booking.start_date)} al {formatDate(booking.end_date)} · {statusLabel(booking.status)}
                      </span>
                      <small>
                        {booking.guest_name || 'Sin cliente'} {booking.phone ? `· ${booking.phone}` : ''}
                      </small>
                      {booking.notes && <small>{booking.notes}</small>}
                    </div>
                    <button className="icon-button danger" onClick={() => deleteBooking(booking.id)} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="admin-section">
          <h3>Editar propiedades y galería</h3>
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

function AdminCalendar({ properties, bookings, selectedProperty, onSelectedProperty }) {
  const [month, setMonth] = useState(() => new Date())
  const selectedBookings = bookings.filter((booking) => booking.property_id === selectedProperty)
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
        Imágenes por URL, separadas por coma
        <input
          value={listToString(property.images)}
          onChange={(event) => onChange({ ...property, images: event.target.value })}
          placeholder="/images/depto-1.jpg, https://..."
        />
      </label>

      <label className="upload-label">
        <ImagePlus size={18} />
        Subir foto a la galería
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

  return <HomePage />
}

function App() {
  const isAdmin = useMemo(() => window.location.pathname.startsWith('/admin'), [])

  return isAdmin ? <AdminApp /> : <PublicRouter />
}

export default App
