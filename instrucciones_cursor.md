# Project: Maia Sedaca Arquitectura Web App

## 1. Identidad Visual & Estilo
- **Tipografía:** Usar exclusivamente 'Quicksand' de Google Fonts (pesos 300, 400, 500, 700).
- **Paleta de Colores:** - Marfil: #F4F1EB
    - Arena: #E5DED2
    - Oak: #C4AA8A
    - Negro: #1B1B1B
    - Blanco: #FFFFFF
- **Logo:** Localizado en `/public/MaiaSedacaLogo.png`.
- **Regla de Visualización del Logo:** Aplicar `mix-blend-mode: multiply` en el Header y Footer para asegurar que el fondo del PNG sea invisible sobre los fondos claros.

## 2. Navegación (Hamburger Menu)
- **Header:** Botón de 3 líneas (hamburger style) a la derecha. Logo a la izquierda.
- **Interacción:** Al hacer clic, desplegar un menú overlay (dropdown full-screen o lateral) con:
    - OBRAS Y PROYECTOS
    - DETALLES
    - SERVICIOS
    - CONTACTO
    - LOGIN CLIENTES (Enlace a página de autenticación)

## 3. Estructura de Secciones (Landing Page)

### HERO SECTION
- Imagen de alto impacto (Full-width).
- Texto debajo de la imagen (Centrado): 
    - H1: "Arquitectura contemporanea que inspira"
    - P: "Creamos espacios reales, diseñados a la medida de quienes los habitan."

### OBRAS Y PROYECTOS
- Layout: Grid limpio inspirado en mg-arquitectos.com.ar.
- Elementos: Solo Imagen + Nombre del proyecto debajo (Texto en Uppercase, espaciado elegante).

### DETALLES
- Funcionalidad: Carrusel de imágenes con navegación por flechas (Click para avanzar/retroceder).
- Contenido: Imágenes de detalles constructivos y casas.

### SERVICIOS
- Estilo: Minimalista, tipografía clara con separadores sutiles.
- Ítems:
    1. PROYECTO INTEGRAL DE ARQUITECTURA
    2. DIRECCION Y ADMINISTRACIÓN DE OBRAS
    3. CONSULTORÍA DE DISEÑO Y CONSTRUCCIÓN

### CONTACTO
- Texto: "Comencemos a proyectar" y "Estamos listos para escuchar tu idea y transformarla en un espacio concreto."
- Elementos: Formulario (Nombre, Email, Mensaje), Teléfono, Iconos de WhatsApp, Instagram y LinkedIn.
- Funcionalidad: Configurar envío de mail real (usar Resend o integración via API).

## 4. Backend e Integración (Supabase)
- **Database:** Usar Supabase para gestionar proyectos y usuarios.
- **Storage:** Crear un bucket en Supabase Storage para las imágenes de 'Obras' y 'Detalles'.
- **Admin Dashboard (/admin):**
    - Ruta protegida para el administrador.
    - Interfaz para subir nuevas imágenes, editarlas o borrarlas de las secciones dinámicas de la web.
- **Client Login (/login):**
    - Autenticación segura via Supabase Auth.
    - Redirección dinámica: Al loguearse, cada cliente debe ser redirigido a su propia página exclusiva (ej: `/clientes/[client-name]`).

## 5. Notas Técnicas para Codex
- Framework sugerido: Next.js con Tailwind CSS.
- Componentes: Usar componentes interactivos para el menú y el carrusel (ej: Swiper.js o Framer Motion para las transiciones).
- Responsividad: Priorizar la experiencia mobile-first para el menú hamburguesa y el carrusel táctil.