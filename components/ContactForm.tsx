'use client';

import { FormEvent, useState } from 'react';

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      phone: '',
      details: String(formData.get('details') || '')
    };

    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      form.reset();
      setMessage('Gracias, el mensaje fue enviado correctamente.');
    } else {
      setMessage('No se pudo enviar el mensaje. Revisá la configuración SMTP.');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="contacto-form">
      <input name="name" placeholder="Nombre" required />
      <input name="email" type="email" placeholder="Email" required />
      <textarea name="details" rows={5} placeholder="Tu mensaje / Idea del proyecto" required />
      <button type="submit" className="btn-send" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar Mensaje'}
      </button>
      {message ? <p className="contact-message">{message}</p> : null}
    </form>
  );
}
