import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import {
  Route,
  MapPin,
  Navigation,
  Play,
  Plus,
  Minus,
  GripVertical,
  Twitter,
  Instagram,
  Youtube,
  Github,
  Map,
} from 'lucide-react';

const heroImageUrl =
  'https://images.unsplash.com/photo-1765320600103-95f1edf1e4b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE2MjE5NjJ8&ixlib=rb-4.1.0&q=80&w=1080';
const mapImageUrl =
  'https://images.unsplash.com/photo-1551077620-ab9a566e2584?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE2MjIwMzV8&ixlib=rb-4.1.0&q=80&w=1080';
const card1ImageUrl =
  'https://images.unsplash.com/photo-1722992587258-77963d7cff88?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE2MjIwNzB8&ixlib=rb-4.1.0&q=80&w=1080';
const card2ImageUrl =
  'https://images.unsplash.com/photo-1761895564993-ede2815838e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE2MjIwODF8&ixlib=rb-4.1.0&q=80&w=1080';
const card3ImageUrl =
  'https://images.unsplash.com/photo-1761444892864-3e5e6e4a51d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE2MjIwODl8&ixlib=rb-4.1.0&q=80&w=1080';
const ctaImageUrl =
  'https://images.unsplash.com/photo-1726463711694-3a2d138c2fae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE2MjIxNjN8&ixlib=rb-4.1.0&q=80&w=1080';

const waypoints = [
  { num: '1', name: 'MULHOLLAND DRIVE', meta: '34.1 mi  \u00b7  Scenic Canyon Road', filled: true },
  { num: '2', name: 'PACIFIC COAST HWY', meta: '56.8 mi  \u00b7  Coastal Highway', filled: true },
  { num: '3', name: 'ANGELES CREST HWY', meta: '66.2 mi  \u00b7  Mountain Pass', filled: true },
  { num: '4', name: 'ORTEGA HIGHWAY', meta: '23.5 mi  \u00b7  Twisting Mountain Road', filled: false },
];

const roadCards = [
  {
    image: card1ImageUrl,
    tag: 'SCENIC CANYON',
    name: 'MULHOLLAND\nDRIVE',
    desc: 'Legendary twisting road through the Santa Monica Mountains with panoramic views of LA and the San Fernando Valley.',
    dist: '34.1 MI',
    stars: '\u2605 \u2605 \u2605 \u2605 \u2606',
  },
  {
    image: card2ImageUrl,
    tag: 'COASTAL HIGHWAY',
    name: 'PACIFIC COAST\nHIGHWAY',
    desc: "America's most iconic coastal drive with dramatic cliffs, crashing waves, and breathtaking Pacific views at every turn.",
    dist: '56.8 MI',
    stars: '\u2605 \u2605 \u2605 \u2605 \u2605',
  },
  {
    image: card3ImageUrl,
    tag: 'MOUNTAIN PASS',
    name: 'ANGELES CREST\nHIGHWAY',
    desc: 'A thrilling mountain highway climbing through the San Gabriel range with hairpin turns, alpine views, and elevation changes.',
    dist: '66.2 MI',
    stars: '\u2605 \u2605 \u2605 \u2605 \u2605',
  },
];

const steps = [
  {
    num: '01',
    title: 'DROP WAYPOINTS',
    desc: "Browse the county's top-rated driving roads and add your favorites as waypoints on the interactive map.",
    filled: false,
  },
  {
    num: '02',
    title: 'OPTIMIZE YOUR ROUTE',
    desc: 'Drag and reorder waypoints to find the optimal sequence. Get real-time distance, elevation, and time estimates.',
    filled: true,
  },
  {
    num: '03',
    title: 'HIT THE ROAD',
    desc: 'Export your route to your favorite GPS app, share it with friends, or save it for the community to discover.',
    filled: false,
  },
];

const testimonials = [
  {
    stars: '\u2605 \u2605 \u2605 \u2605 \u2605',
    quote: '\u201cMulholland at golden hour was beyond anything I imagined. This app found roads I never knew existed just 30 minutes from home.\u201d',
    name: 'MARCUS CHEN',
    role: 'Weekend Explorer  \u00b7  247 routes',
    highlight: false,
  },
  {
    stars: '\u2605 \u2605 \u2605 \u2605 \u2605',
    quote: '\u201cWe planned our entire cross-county road trip in under 10 minutes. The waypoint system is incredibly intuitive.\u201d',
    name: 'SARAH BLACKWOOD',
    role: 'Road Trip Photographer  \u00b7  89 routes',
    highlight: true,
  },
  {
    stars: '\u2605 \u2605 \u2605 \u2605 \u2606',
    quote: "\u201cAs a driving enthusiast, I've tried every route app out there. Roadrunner is the only one that understands what makes a road worth driving.\u201d",
    name: 'JAMES RIVERA',
    role: 'Car Enthusiast  \u00b7  412 routes',
    highlight: false,
  },
];

const stats = [
  { value: '12,847', label: 'Routes Created' },
  { value: '3.2M', label: 'Miles Driven' },
  { value: '48', label: 'Counties Mapped' },
  { value: '4.9', label: 'Avg. Rating' },
];

const filterTabs = ['ALL', 'SCENIC', 'MOUNTAIN', 'COASTAL'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-cormorant">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0D0D0DCC] backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-6 md:px-12 lg:px-[120px] py-5">
          <div className="flex items-center gap-3">
            <Route className="w-7 h-7 text-accent-gold" />
            <span className="font-bebas text-[26px] tracking-[3px] text-text-primary">ROADRUNNER</span>
          </div>
          <nav className="hidden lg:flex items-center gap-10">
            <a href="#explore" className="font-bebas text-sm tracking-[2px] text-text-secondary hover:text-text-primary transition-colors">EXPLORE</a>
            <a href="#routes" className="font-bebas text-sm tracking-[2px] text-text-secondary hover:text-text-primary transition-colors">ROUTES</a>
            <a href="#community" className="font-bebas text-sm tracking-[2px] text-text-secondary hover:text-text-primary transition-colors">COMMUNITY</a>
            <a href="#about" className="font-bebas text-sm tracking-[2px] text-text-secondary hover:text-text-primary transition-colors">ABOUT</a>
            <Link
              href="/planner"
              className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-7 py-3 hover:brightness-110 transition"
            >
              PLAN YOUR TRIP
            </Link>
          </nav>
          <MobileNav />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-[500px] md:min-h-[600px] lg:min-h-[700px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImageUrl})` }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0D0D0DEE 0%, #0D0D0D99 50%, #0D0D0DEE 100%)' }} />
        <div className="relative z-10 flex flex-col justify-center h-full max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] pt-24 lg:pt-[120px] pb-12 lg:pb-20 gap-6 lg:gap-8">
          <div className="flex items-center gap-2 border border-accent-gold px-4 py-2 w-fit">
            <MapPin className="w-3.5 h-3.5 text-accent-gold" />
            <span className="font-bebas text-xs tracking-[3px] text-accent-gold">DISCOVER THE BEST DRIVING ROADS</span>
          </div>
          <h1 className="font-bebas text-4xl sm:text-5xl md:text-6xl lg:text-[80px] leading-[0.9] tracking-tight text-text-primary">
            EVERY GREAT<br />JOURNEY STARTS<br />WITH A WAYPOINT
          </h1>
          <p className="font-cormorant text-lg lg:text-xl italic text-text-secondary leading-relaxed max-w-[580px]">
            Plan your perfect road trip by selecting the most scenic, thrilling,
            and unforgettable driving roads — one waypoint at a time.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href="/planner"
              className="flex items-center justify-center gap-2.5 bg-accent-gold px-9 py-4 font-bebas text-base tracking-[2px] text-bg-primary hover:brightness-110 transition w-full sm:w-auto"
            >
              <Navigation className="w-[18px] h-[18px]" />
              START PLANNING
            </Link>
            <button className="flex items-center justify-center gap-2.5 border border-text-secondary px-9 py-4 font-bebas text-base tracking-[2px] text-text-secondary hover:border-text-primary hover:text-text-primary transition w-full sm:w-auto">
              <Play className="w-4 h-4" />
              WATCH DEMO
            </button>
          </div>
        </div>
      </section>

      {/* ── Route Builder ── */}
      <section id="explore" className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] py-12 lg:py-20">
        <div className="flex flex-col gap-8 lg:gap-12">
          <span className="font-bebas text-sm tracking-[6px] text-accent-gold">ROUTE PLANNER</span>
          <div className="flex flex-col gap-4">
            <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl tracking-tight leading-[0.95] text-text-primary">BUILD YOUR PERFECT ROUTE</h2>
            <p className="font-cormorant text-lg italic text-text-secondary leading-relaxed max-w-[640px]">
              Drop waypoints on the map to chart your course through the county&apos;s best driving roads.
              Drag to reorder, click to explore each road&apos;s details.
            </p>
          </div>

          {/* Route Builder mockup */}
          <div className="flex flex-col lg:flex-row h-auto lg:h-[520px] overflow-hidden">
            {/* Waypoint Sidebar */}
            <div className="w-full lg:w-[360px] lg:flex-shrink-0 bg-bg-card border border-border-subtle flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <span className="font-bebas text-base tracking-[3px] text-text-primary">WAYPOINTS</span>
                <span className="flex items-center gap-1.5 bg-accent-gold px-3.5 py-1.5 font-bebas text-[11px] tracking-[2px] text-bg-primary">
                  <Plus className="w-3 h-3" />
                  ADD
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {waypoints.map((wp) => (
                  <div key={wp.num} className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle">
                    <div
                      className={`w-7 h-7 flex items-center justify-center font-bebas text-sm flex-shrink-0 ${
                        wp.filled
                          ? 'bg-accent-gold text-bg-primary'
                          : 'border border-accent-gold text-accent-gold'
                      }`}
                    >
                      {wp.num}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="font-bebas text-[15px] tracking-[1px] text-text-primary">{wp.name}</span>
                      <span className="font-cormorant text-[13px] italic text-text-secondary">{wp.meta}</span>
                    </div>
                    <GripVertical className="w-4 h-4 text-text-disabled flex-shrink-0" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-bg-muted px-5 py-4">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">180.6</span>
                  <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">TOTAL MI</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">4H 12M</span>
                  <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">EST. TIME</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">4</span>
                  <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">STOPS</span>
                </div>
              </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative overflow-hidden h-[300px] lg:h-auto">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${mapImageUrl})` }}
              />
              <div className="absolute inset-0 bg-[#0D0D0D44]" />
              {/* Map pins */}
              <div className="absolute w-8 h-8 flex items-center justify-center bg-accent-gold font-bebas text-sm text-bg-primary" style={{ left: '21%', top: '23%' }}>1</div>
              <div className="absolute w-8 h-8 flex items-center justify-center bg-accent-gold font-bebas text-sm text-bg-primary" style={{ left: '38%', top: '38%' }}>2</div>
              <div className="absolute w-8 h-8 flex items-center justify-center bg-accent-gold font-bebas text-sm text-bg-primary" style={{ left: '60%', top: '29%' }}>3</div>
              <div className="absolute w-8 h-8 flex items-center justify-center border-2 border-accent-gold font-bebas text-sm text-accent-gold" style={{ left: '77%', top: '58%' }}>4</div>
              {/* Zoom controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-0.5">
                <div className="w-9 h-9 bg-bg-card border border-border-subtle flex items-center justify-center">
                  <Plus className="w-4 h-4 text-text-secondary" />
                </div>
                <div className="w-9 h-9 bg-bg-card border border-border-subtle flex items-center justify-center">
                  <Minus className="w-4 h-4 text-text-secondary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Roads ── */}
      <section id="routes" className="bg-bg-card">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] py-12 lg:py-20">
          <div className="flex flex-col gap-8 lg:gap-12">
            <span className="font-bebas text-sm tracking-[6px] text-accent-gold">FEATURED ROADS</span>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl tracking-tight leading-[0.95] text-text-primary">
                THE COUNTY&apos;S FINEST<br />DRIVING ROADS
              </h2>
              <div className="flex flex-wrap">
                {filterTabs.map((tab, i) => (
                  <button
                    key={tab}
                    className={`font-bebas text-xs tracking-[2px] px-5 py-2.5 transition ${
                      i === 0
                        ? 'bg-accent-gold text-bg-primary'
                        : 'border border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-secondary'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roadCards.map((card) => (
                <div key={card.tag} className="border border-border-subtle flex flex-col">
                  <div
                    className="h-[200px] bg-cover bg-center"
                    style={{ backgroundImage: `url(${card.image})` }}
                  />
                  <div className="bg-bg-primary p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent-gold" />
                      <span className="font-bebas text-[11px] tracking-[2px] text-accent-gold">{card.tag}</span>
                    </div>
                    <h3 className="font-bebas text-[28px] tracking-[1px] leading-[0.95] text-text-primary whitespace-pre-line">{card.name}</h3>
                    <p className="font-cormorant text-sm italic text-text-secondary leading-relaxed">{card.desc}</p>
                    <div className="flex items-center gap-5 mt-auto">
                      <span className="font-bebas text-[13px] tracking-[1px] text-text-muted">{card.dist}</span>
                      <span className="font-cormorant text-sm text-accent-gold">{card.stars}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-bg-primary">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] py-12 lg:py-20 flex flex-col items-center gap-10 lg:gap-16">
          <span className="font-bebas text-sm tracking-[6px] text-accent-gold">HOW IT WORKS</span>
          <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl tracking-tight leading-[0.95] text-text-primary text-center">
            THREE STEPS TO YOUR<br />PERFECT ROAD TRIP
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full">
            {steps.map((step) => (
              <div key={step.num} className="flex flex-col items-center gap-5">
                <div
                  className={`w-16 h-16 flex items-center justify-center font-bebas text-[28px] tracking-[1px] ${
                    step.filled
                      ? 'bg-accent-gold text-bg-primary'
                      : 'border-2 border-accent-gold text-accent-gold'
                  }`}
                >
                  {step.num}
                </div>
                <h3 className="font-bebas text-[22px] tracking-[1px] text-text-primary text-center">{step.title}</h3>
                <p className="font-cormorant text-base italic text-text-secondary leading-relaxed text-center">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community ── */}
      <section id="community" className="bg-bg-card">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] py-12 lg:py-20 flex flex-col gap-10 lg:gap-16">
          <span className="font-bebas text-sm tracking-[6px] text-accent-gold">COMMUNITY</span>
          <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl tracking-tight leading-[0.95] text-text-primary">DRIVEN BY ENTHUSIASTS</h2>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:justify-between py-8 border-y border-border-subtle">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <span className="font-bebas text-3xl md:text-[42px] tracking-[1px] text-accent-gold">{stat.value}</span>
                <span className="font-cormorant text-base italic text-text-secondary">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className={`bg-bg-primary p-6 flex flex-col gap-4 border ${
                  t.highlight ? 'border-accent-gold' : 'border-border-subtle'
                }`}
              >
                <span className="font-cormorant text-base text-accent-gold">{t.stars}</span>
                <p className="font-cormorant text-base italic text-text-primary leading-relaxed">{t.quote}</p>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="w-1 h-8 bg-accent-gold" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bebas text-sm tracking-[1px] text-text-primary">{t.name}</span>
                    <span className="font-cormorant text-[13px] italic text-text-secondary">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative min-h-[360px] md:min-h-[480px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ctaImageUrl})` }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0D0D0DDD 0%, #0D0D0DAA 50%, #0D0D0DDD 100%)' }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6 px-6 md:px-12 lg:px-[120px] py-12 md:py-20">
          <h2 className="font-bebas text-4xl md:text-5xl lg:text-[64px] tracking-tight leading-[0.9] text-text-primary text-center">
            THE OPEN ROAD<br />IS CALLING
          </h2>
          <p className="font-cormorant text-xl italic text-text-secondary text-center leading-relaxed">
            Join thousands of driving enthusiasts who&apos;ve discovered<br />roads they never knew existed.
          </p>
          <Link
            href="/planner"
            className="flex items-center gap-2.5 bg-accent-gold px-12 py-[18px] font-bebas text-lg tracking-[2px] text-bg-primary hover:brightness-110 transition"
          >
            <Map className="w-5 h-5" />
            START YOUR JOURNEY
          </Link>
          <span className="font-cormorant text-sm italic text-text-muted">
            Free forever  &middot;  No account required  &middot;  Export anywhere
          </span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="about" className="bg-bg-primary border-t border-border-subtle">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] pt-12 lg:pt-16 pb-8 flex flex-col gap-12">
          {/* Top */}
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="flex flex-col gap-4 max-w-[300px]">
              <div className="flex items-center gap-3">
                <Route className="w-6 h-6 text-accent-gold" />
                <span className="font-bebas text-[22px] tracking-[3px] text-text-primary">ROADRUNNER</span>
              </div>
              <p className="font-cormorant text-sm italic text-text-secondary leading-relaxed">
                Discover the world&apos;s most unforgettable driving roads. Built by enthusiasts, for enthusiasts.
              </p>
            </div>
            <div className="flex gap-8 flex-wrap md:gap-20">
              <div className="flex flex-col gap-4">
                <span className="font-bebas text-[13px] tracking-[3px] text-accent-gold">EXPLORE</span>
                <span className="font-cormorant text-sm italic text-text-secondary">All Routes</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Scenic Roads</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Mountain Passes</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Coastal Highways</span>
              </div>
              <div className="flex flex-col gap-4">
                <span className="font-bebas text-[13px] tracking-[3px] text-accent-gold">COMPANY</span>
                <span className="font-cormorant text-sm italic text-text-secondary">About Us</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Blog</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Careers</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Contact</span>
              </div>
              <div className="flex flex-col gap-4">
                <span className="font-bebas text-[13px] tracking-[3px] text-accent-gold">LEGAL</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Privacy Policy</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Terms of Service</span>
                <span className="font-cormorant text-sm italic text-text-secondary">Cookie Policy</span>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
            <span className="font-cormorant text-[13px] italic text-text-disabled">&copy; 2026 Roadrunner. All rights reserved.</span>
            <div className="flex items-center gap-5">
              <Twitter className="w-[18px] h-[18px] text-text-disabled hover:text-text-secondary transition-colors cursor-pointer" />
              <Instagram className="w-[18px] h-[18px] text-text-disabled hover:text-text-secondary transition-colors cursor-pointer" />
              <Youtube className="w-[18px] h-[18px] text-text-disabled hover:text-text-secondary transition-colors cursor-pointer" />
              <Github className="w-[18px] h-[18px] text-text-disabled hover:text-text-secondary transition-colors cursor-pointer" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
