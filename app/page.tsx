import { ContactForm } from '@/components/ContactForm';
import { ImageCarousel } from '@/components/ImageCarousel';

const proyectos = [
  {
    name: 'Casa Nordelta',
    image:
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Residencia El Naudir',
    image:
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Vivienda Escobar',
    image:
      'https://images.unsplash.com/photo-1600607687940-47a04b697a7d?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Casa Benavidez',
    image:
      'https://images.unsplash.com/photo-1600566753190-17f0bb2a6c3e?auto=format&fit=crop&w=800&q=80'
  }
];

const detalles = [
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=600&q=80'
];

const servicios = [
  'PROYECTO INTEGRAL DE ARQUITECTURA',
  'DIRECCION Y ADMINISTRACIÓN DE OBRAS',
  'CONSULTORÍA DE DISEÑO Y CONSTRUCCIÓN'
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div
          className="hero-img"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80')"
          }}
        />
        <div className="hero-text">
          <h1>Arquitectura contemporanea que inspira</h1>
          <p>Creamos espacios reales, diseñados a la medida de quienes los habitan.</p>
        </div>
      </section>

      <section id="obras" className="section-shell">
        <h2 className="section-title">Obras y Proyectos</h2>
        <ImageCarousel
          variant="projects"
          items={proyectos.map((proyecto) => ({
            src: proyecto.image,
            alt: proyecto.name,
            caption: proyecto.name
          }))}
        />
      </section>

      <section id="detalles" className="section-shell detalles-section">
        <h2 className="section-title">Detalles</h2>
        <div className="detalles-gallery">
          {detalles.map((detalle, index) => (
            <div className="detalle-card" key={detalle}>
              <img src={detalle} alt={`Detalle ${index + 1}`} />
            </div>
          ))}
        </div>
      </section>

      <section id="servicios" className="section-shell">
        <h2 className="section-title center-title">Servicios</h2>
        <div className="servicios-list">
          {servicios.map((servicio) => (
            <div className="servicio-item" key={servicio}>
              {servicio}
            </div>
          ))}
        </div>
      </section>

      <section id="contacto" className="section-shell">
        <div className="contacto-flex">
          <div>
            <h2 className="section-title contacto-title">Comencemos a proyectar</h2>
            <p className="contacto-copy">
              Estamos listos para escuchar tu idea y transformarla en un espacio concreto.
            </p>
            <p className="contacto-phone">
              <strong>Teléfono:</strong> +54 9 11 0000 0000
            </p>
            <div className="social-icons">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="WhatsApp" />
              <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" />
              <img src="https://cdn-icons-png.flaticon.com/512/145/145807.png" alt="LinkedIn" />
            </div>
          </div>
          <div>
            <ContactForm />
          </div>
        </div>
      </section>

      <footer>
        <img src="/MaiaSedacaLogo.png" alt="Maia Sedaca" className="footer-logo" />
        <p>&copy; 2026 Maia Sedaca Arquitectura. Buenos Aires, Argentina.</p>
      </footer>
    </main>
  );
}
