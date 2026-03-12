import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import CountUp from 'react-countup'
import { FiArrowRight, FiMapPin, FiUsers, FiCalendar, FiStar } from 'react-icons/fi'
import { MdSportsTennis, MdSportsBasketball, MdSportsCricket, MdSportsSoccer, MdDirectionsRun, MdSportsVolleyball } from 'react-icons/md'

const fadeUp = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } } }
const stagger = { visible: { transition: { staggerChildren: 0.12 } } }

/* Free Unsplash sports images */
const HERO_IMG = 'https://images.unsplash.com/photo-1529926706528-db9e5010cd3e?w=1400&q=80&auto=format'
const SPORTS = [
  { name: 'Football',   icon: MdSportsSoccer,     img: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=600&q=80', players: '5v5',  games: 23 },
  { name: 'Basketball', icon: MdSportsBasketball,  img: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80', players: '5v5',  games: 18 },
  { name: 'Tennis',     icon: MdSportsTennis,      img: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&q=80', players: '1v1',  games: 12 },
  { name: 'Cricket',    icon: MdSportsCricket,     img: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80', players: '11v11', games: 15 },
  { name: 'Running',    icon: MdDirectionsRun,     img: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80', players: 'Group', games: 8 },
  { name: 'Volleyball', icon: MdSportsVolleyball,  img: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600&q=80', players: '6v6',  games: 10 },
]

const STATS = [
  { end: 1247, suffix: '+', label: 'Active Players', icon: FiUsers },
  { end: 89,   suffix: '',  label: 'Games Weekly',   icon: FiCalendar },
  { end: 23,   suffix: '',  label: 'Venues',         icon: FiMapPin },
  { end: 98,   suffix: '%', label: 'Satisfaction',    icon: FiStar },
]

const FEATURES = [
  { title: 'Discover Nearby', desc: 'GPS-based game discovery helps you find sports happening around you — from pickup football to casual badminton.', icon: FiMapPin },
  { title: 'Build Your Crew', desc: 'Join games, rate players, and build lasting connections with like-minded sports enthusiasts in your area.', icon: FiUsers },
  { title: 'Easy Scheduling', desc: 'Post a game in 30 seconds — set sport, skill level, time, slots, and location. We handle the rest.', icon: FiCalendar },
]

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.15 })
  return (
    <motion.section ref={ref} variants={stagger} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.section>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ──── Hero ──── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-surface to-accentLight/30 min-h-[90vh] flex items-center">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-[400px] h-[400px] rounded-full bg-info/5 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <span className="chip mb-6">New: Real-time Game Notifications</span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-dark leading-[1.08] tracking-tight mb-6">
              Find Your<br />
              <span className="text-gradient">Game Crew</span>
            </h1>
            <p className="text-lg md:text-xl text-textSecondary leading-relaxed max-w-lg mb-8">
              Discover nearby sports games, post your own matches, and build your local sports community. Play more, connect better.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/games" className="btn-primary text-base gap-2">
                Explore Games <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/create" className="btn-secondary text-base">
                Post a Game
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block">
            <div className="relative rounded-3xl overflow-hidden shadow-elevated">
              <img src={HERO_IMG} alt="Sports community playing together" className="w-full h-[480px] object-cover" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/20 to-transparent" />
            </div>
            {/* Floating stat card */}
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
              className="absolute -bottom-6 -left-6 glass-card p-4 flex items-center gap-3 shadow-elevated">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                <FiUsers className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-textPrimary">1,247+ Players</p>
                <p className="text-xs text-textSecondary">Active this week</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ──── Stats ──── */}
      <Section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="glass-card-solid p-6 text-center card-hover">
                <div className="w-12 h-12 rounded-xl bg-accentLight flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="text-3xl md:text-4xl font-extrabold text-dark mb-1">
                  <CountUp end={s.end} duration={2.5} enableScrollSpy scrollSpyOnce />{s.suffix}
                </div>
                <p className="text-textSecondary text-sm font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ──── Popular Sports ──── */}
      <Section className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="section-heading">Popular Sports</h2>
            <p className="section-sub">Find your favorite sport and jump into the action</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SPORTS.map((sport, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Link to="/games" className="group block relative rounded-2xl overflow-hidden shadow-card card-hover h-72">
                  <img src={sport.img} alt={sport.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark/70 via-dark/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <sport.icon className="w-5 h-5 text-accent" />
                      <h3 className="text-white text-xl font-bold">{sport.name}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/80">
                      <span>{sport.players}</span>
                      <span>{sport.games} games</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ──── How It Works / Features ──── */}
      <Section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="section-heading">How PlayMate Works</h2>
            <p className="section-sub">Three simple steps to get in the game</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <motion.div key={i} variants={fadeUp} className="glass-card-solid p-8 text-center card-hover group">
                <div className="w-16 h-16 rounded-2xl bg-accentLight flex items-center justify-center mx-auto mb-6 group-hover:bg-accent group-hover:shadow-glow transition-all duration-300">
                  <f.icon className="w-7 h-7 text-accent group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-textPrimary mb-3">{f.title}</h3>
                <p className="text-textSecondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ──── CTA ──── */}
      <Section className="py-24 bg-gradient-to-r from-accent to-accentDark">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div variants={fadeUp}>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to Play?</h2>
            <p className="text-white/80 text-lg mb-10 max-w-2xl mx-auto">
              Join thousands of sports enthusiasts already enjoying the game. Create your account and start your sports journey today!
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/register" className="inline-flex items-center gap-2 bg-white text-accent font-semibold px-8 py-4 rounded-xl shadow-elevated hover:shadow-card hover:-translate-y-0.5 transition-all duration-300">
                Get Started Free <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/games" className="inline-flex items-center gap-2 bg-white/15 text-white border-2 border-white/30 font-semibold px-8 py-4 rounded-xl hover:bg-white/25 transition-all duration-300">
                Browse Games
              </Link>
            </div>
          </motion.div>
        </div>
      </Section>
    </div>
  )
}
