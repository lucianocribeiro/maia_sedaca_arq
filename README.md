# Maia Sedaca Arq - Base Inicial

Web page para Maia Sedaca Arquitectura.

## Requisitos
- Node.js 18+
- Un proyecto de Supabase con Auth habilitado
- Un bucket de Storage llamado `gallery`
- Credenciales SMTP para el formulario de contacto

## Configuración
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar variables:
   ```bash
   cp .env.example .env.local
   ```
3. Completar `.env.local`.
4. Correr en local:
   ```bash
   npm run dev
   ```

## Qué incluye esta base
- Fuente global: **Quicksand**.
- Layout inicial con menú hamburguesa.
- Sección `Detalles` con carrusel navegable por flechas.
- `Login` para clientes con Supabase Auth (email/password).
- Ruta `/admin` protegida y panel para subir/eliminar imágenes en Supabase Storage.
- Formulario de contacto conectado a `/api/contact` para envío de emails por SMTP.

## Notas de Supabase
- Definir políticas RLS para que solo usuarios autenticados puedan gestionar archivos en `gallery`.
- Si querés galería pública, configurar el bucket como público o generar URLs firmadas.
