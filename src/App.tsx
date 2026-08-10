import { useEffect, useRef, useState } from 'react'

// ─── Intersection observer hook ─────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.querySelectorAll('.fade-up').forEach((child) => {
            child.classList.add('visible')
          })
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

// ─── Tag chip ────────────────────────────────────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-muted)',
        border: '1px solid var(--color-border)',
        padding: '3px 10px',
        borderRadius: '100px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  )
}

// ─── Projects data ────────────────────────────────────────────────────────────
const projects = [
  {
    num: '01',
    title: 'Clarity — Enterprise Analytics Redesign',
    summary:
      'A fragmented analytics platform was preventing data teams from making fast decisions. I led a full UX and UI redesign, consolidating seven disconnected views into a single adaptive workspace — reducing time-to-insight by 40%.',
    tags: ['Product Design', 'UX', 'UI'],
    img: 'https://images.unsplash.com/photo-1771923082503-0a3381c46cef?w=1200&h=700&fit=crop&auto=format',
    alt: 'Dark-themed dashboard interface on a modern laptop',
    bg: '#1A1A18',
  },
  {
    num: '02',
    title: 'Vessel — B2B Onboarding Flow',
    summary:
      'New users were churning before reaching core value in a complex SaaS product. I researched the friction points and redesigned the onboarding experience end-to-end, increasing 7-day activation by 28%.',
    tags: ['Product Strategy', 'UX Research', 'Interaction Design'],
    img: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=1200&h=700&fit=crop&auto=format',
    alt: 'Wireframe sketches and design documentation',
    bg: '#F0EDE6',
  },
  {
    num: '03',
    title: 'Forma — Design System at Scale',
    summary:
      'With six product teams working in parallel, design inconsistency was slowing shipping velocity. I built and documented a cross-platform design system adopted by 18 engineers and 4 designers within one quarter.',
    tags: ['Design Systems', 'UI Design', 'Product Design'],
    img: 'https://images.unsplash.com/photo-1677691820099-a6e8040aa077?w=1200&h=700&fit=crop&auto=format',
    alt: 'Clean interface with structured menu system',
    bg: '#E8E4F0',
  },
]

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, index }: { project: (typeof projects)[0]; index: number }) {
  const [hovered, setHovered] = useState(false)
  const isEven = index % 2 === 0

  return (
    <div
      className="project-card fade-up"
      style={{
        borderTop: '1px solid var(--color-border)',
        paddingTop: '4rem',
        paddingBottom: '4rem',
      }}
    >
      {/* Number + title row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '4rem 1fr',
          gap: '2rem',
          alignItems: 'start',
          marginBottom: '2.5rem',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.875rem',
            fontWeight: 400,
            color: 'var(--color-muted)',
            paddingTop: '0.3rem',
          }}
        >
          {project.num}
        </span>
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 600,
              lineHeight: 1.1,
              margin: '0 0 1rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            {project.title}
          </h3>
          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: 'var(--color-muted)',
              margin: '0 0 1.25rem 0',
              maxWidth: '52ch',
            }}
          >
            {project.summary}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {project.tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </div>
          <a
            href="#work"
            className="link-underline"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-fg)',
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}
          >
            View case study →
          </a>
        </div>
      </div>

      {/* Image */}
      <div
        style={{
          overflow: 'hidden',
          borderRadius: '4px',
          backgroundColor: project.bg,
          aspectRatio: isEven ? '16/7' : '16/8',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          className="project-img"
          src={project.img}
          alt={project.alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: hovered ? 'scale(1.03)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const heroRef = useFadeIn()
  const workRef = useFadeIn()
  const aboutRef = useFadeIn()
  const contactRef = useFadeIn()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--color-bg)' }}>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: '0 clamp(1.5rem, 5vw, 4rem)',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: scrolled ? 'rgba(245, 245, 242, 0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--color-border)' : '1px solid transparent',
          transition: 'background-color 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
        }}
      >
        <a
          href="#"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            color: 'var(--color-fg)',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Mia Lindgren
        </a>

        {/* Desktop links */}
        <div
          style={{
            display: 'flex',
            gap: '2.5rem',
            alignItems: 'center',
          }}
          className="desktop-nav"
        >
          {['Work', 'About', 'Contact'].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="nav-link"
              style={{ textDecoration: 'none' }}
            >
              {link}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        ref={heroRef}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(6rem, 12vw, 10rem) clamp(1.5rem, 5vw, 4rem) clamp(4rem, 8vw, 6rem)',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div className="fade-up stagger-1">
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              margin: '0 0 2rem 0',
            }}
          >
            Product Designer — Stockholm
          </p>
        </div>

        <h1
          className="fade-up stagger-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.75rem, 7vw, 6rem)',
            fontWeight: 600,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            margin: '0 0 2rem 0',
            maxWidth: '18ch',
          }}
        >
          Product designer creating clear experiences for complex products.
        </h1>

        <p
          className="fade-up stagger-3"
          style={{
            fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
            lineHeight: 1.65,
            color: 'var(--color-muted)',
            maxWidth: '52ch',
            margin: '0 0 3rem 0',
          }}
        >
          I design digital products by combining user insight, product thinking, and thoughtful
          interaction design.
        </p>

        <a
          href="#work"
          className="fade-up stagger-4 link-underline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: 'var(--color-fg)',
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          View selected work ↓
        </a>
      </section>

      {/* ── Selected Work ───────────────────────────────────────────────────── */}
      <section
        id="work"
        ref={workRef}
        style={{
          padding: 'clamp(4rem, 8vw, 7rem) clamp(1.5rem, 5vw, 4rem)',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          className="fade-up"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '1rem',
            marginBottom: '0.5rem',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Selected work
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>3 projects</span>
        </div>

        <div>
          {projects.map((project, i) => (
            <ProjectCard key={project.num} project={project} index={i} />
          ))}
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────────── */}
      <section
        id="about"
        ref={aboutRef}
        style={{
          padding: 'clamp(4rem, 8vw, 7rem) clamp(1.5rem, 5vw, 4rem)',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(3rem, 6vw, 6rem)',
            alignItems: 'start',
          }}
        >
          <div>
            <h2
              className="fade-up"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                margin: '0 0 2rem 0',
              }}
            >
              About
            </h2>

            <p
              className="fade-up stagger-1"
              style={{
                fontSize: 'clamp(1.125rem, 2vw, 1.375rem)',
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
                margin: '0 0 1.5rem 0',
                maxWidth: '42ch',
              }}
            >
              I'm a product designer focused on making complex digital products feel simple and
              intuitive.
            </p>

            <p
              className="fade-up stagger-2"
              style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'var(--color-muted)',
                margin: 0,
                maxWidth: '48ch',
              }}
            >
              I work across UX, interaction design, UI, product strategy, and design systems — from
              understanding the problem to shipping the final experience.
            </p>
          </div>

          <div
            className="fade-up stagger-2"
            style={{ paddingTop: '3.5rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2rem',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--color-muted)',
                    margin: '0 0 0.5rem 0',
                  }}
                >
                  Currently
                </p>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.4, margin: 0 }}>
                  Product Designer
                  <br />
                  at Northvolt
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--color-muted)',
                    margin: '0 0 0.5rem 0',
                  }}
                >
                  Based in
                </p>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.4, margin: 0 }}>
                  Stockholm, Sweden
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────────── */}
      <section
        id="contact"
        ref={contactRef}
        style={{
          padding: 'clamp(5rem, 10vw, 9rem) clamp(1.5rem, 5vw, 4rem)',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <h2
          className="fade-up"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            margin: '0 0 1.5rem 0',
            maxWidth: '16ch',
          }}
        >
          Let's make something useful.
        </h2>

        <p
          className="fade-up stagger-1"
          style={{
            fontSize: '1.0625rem',
            lineHeight: 1.6,
            color: 'var(--color-muted)',
            margin: '0 0 3.5rem 0',
            maxWidth: '48ch',
          }}
        >
          I'm always interested in thoughtful products, ambitious teams, and interesting design
          problems.
        </p>

        <div className="fade-up stagger-2" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <a
            href="mailto:mia@mialindgren.se"
            className="link-underline"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.25rem, 3vw, 2rem)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--color-fg)',
              textDecoration: 'none',
            }}
          >
            mia@mialindgren.se →
          </a>

          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
            {[
              { label: 'LinkedIn', href: 'https://linkedin.com' },
              { label: 'GitHub', href: 'https://github.com' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline"
                style={{
                  fontSize: '0.9375rem',
                  color: 'var(--color-muted)',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-fg)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: '1.75rem clamp(1.5rem, 5vw, 4rem)',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-muted)',
            margin: 0,
          }}
        >
          © 2026 Mia Lindgren
        </p>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[
            { label: 'LinkedIn', href: 'https://linkedin.com' },
            { label: 'GitHub', href: 'https://github.com' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
              style={{ textDecoration: 'none', fontSize: '0.8125rem' }}
            >
              {label}
            </a>
          ))}
        </div>
      </footer>

      {/* ── Mobile nav override ─────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 640px) {
          .desktop-nav {
            gap: 1.5rem !important;
          }
          .desktop-nav a {
            font-size: 0.8125rem !important;
          }
        }
      `}</style>
    </div>
  )
}
