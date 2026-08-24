import React from 'react';
import { Link } from 'react-router-dom';

export default function Contact() {
  const socialChannels = [
    { name: 'X (Twitter)', url: 'https://x.com/MericetCorp', label: '@MericetCorp' },
    { name: 'Instagram', url: 'https://www.instagram.com/mericet_hq/', label: '@mericet_hq' },
    { name: 'Reddit', url: 'https://www.reddit.com/user/_Mericet_/', label: 'u/_Mericet_' },
    { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61573269025605', label: 'Mericet' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/company/mericetapp/', label: 'Mericet' },
    { name: 'WhatsApp Channel', url: 'https://whatsapp.com/channel/0029VbAzkgk77qVUtQqZ2c2f', label: 'Mericet Channel' },
    { name: 'YouTube', url: 'https://www.youtube.com/@mericetapp', label: '@mericetapp' },
  ];

  return (
    <div style={{ backgroundColor: '#0a0e17', color: '#94a3b8', minHeight: '100vh', padding: '60px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', lineHeight: '1.7' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
            &larr; Back to Home
          </Link>
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>Contact Us</h1>
        <div style={{ color: '#3b82f6', fontSize: '0.95rem', fontWeight: 600, marginBottom: '3rem', textTransform: 'uppercase' }}>Get in Touch with Mericet</div>

        <p>If you have any questions, feedback, support requests, or inquiry regarding Mericet, please reach out to our support team or connect with us on our official social channels.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2.5rem', color: '#ffffff', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>Support Email</h2>
        <p>For general inquiries, account support, and privacy or legal questions, you can contact us directly via email:</p>
        <div style={{ backgroundColor: '#131b2e', padding: '16px 20px', borderRadius: '8px', border: '1px solid #1e293b', marginTop: '1rem', marginBottom: '2rem' }}>
          <strong style={{ color: '#f8fafc', marginRight: '8px' }}>Email:</strong>
          <a href="mailto:mericet.team+support@gmail.com" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            mericet.team+support@gmail.com
          </a>
        </div>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2.5rem', color: '#ffffff', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>Official Social & Community Channels</h2>
        <p>Follow us and reach out to the Mericet team across our official platforms:</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px', marginTop: '1.5rem' }}>
          {socialChannels.map((channel) => (
            <div key={channel.name} style={{ backgroundColor: '#131b2e', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>{channel.name}</div>
              <a
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.9rem', wordBreak: 'break-all' }}
              >
                {channel.label} &rarr;
              </a>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2.5rem', color: '#ffffff', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>Legal & Policy Links</h2>
        <p style={{ marginTop: '1rem' }}>
          For details regarding account terms and privacy practices, please refer to our legal documents:
        </p>
        <ul style={{ paddingLeft: '20px', marginTop: '0.5rem' }}>
          <li style={{ marginBottom: '8px' }}>
            <Link to="/terms-of-service" style={{ color: '#3b82f6', textDecoration: 'none' }}>
              Terms of Service
            </Link>
          </li>
          <li style={{ marginBottom: '8px' }}>
            <Link to="/privacy-policy" style={{ color: '#3b82f6', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
