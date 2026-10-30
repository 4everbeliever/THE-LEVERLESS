import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Brand } from '../components/Brand'
import { FullPageLoader } from '../components/FullPageLoader'
import { Badge, Button, Icon, type IconName } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { useBranches, useItems } from '../hooks/useInventory'
import type { RentalItem } from '../types/rental'

export default function Home() {
  const { session, isPending: authPending } = useAuth()
  const { data: items = [], isPending: itemsPending } = useItems()
  const { data: branches = [] } = useBranches()
  const navigate = useNavigate()

  const [categoryFilter, setCategoryFilter] = useState('All')
  const [branchFilter, setBranchFilter] = useState('All branches')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItemForPrompt, setSelectedItemForPrompt] = useState<RentalItem | null>(null)

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesCategory = categoryFilter === 'All' || item.category.toLowerCase() === categoryFilter.toLowerCase()
      const matchesBranch =
        branchFilter === 'All branches' ||
        (item.branch && item.branch.toLowerCase().includes(branchFilter.toLowerCase()))
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serial.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesBranch && matchesSearch
    })
  }, [items, categoryFilter, branchFilter, searchQuery])

  const categories = ['All', 'Power tools', 'Cutting tools', 'Demolition', 'Heavy equipment']

  const handleBookClick = (item: RentalItem) => {
    if (session) {
      // User is signed in, direct to dashboard with book prompt
      navigate(`/dashboard?book=${item.id}`)
    } else {
      // Show prompt or take to login
      setSelectedItemForPrompt(item)
    }
  }

  if (authPending) return <FullPageLoader />

  return (
    <div className="storefront-page">
      {/* Top Navigation */}
      <header className="storefront-navbar">
        <div className="storefront-nav-inner">
          <Link to="/" className="storefront-logo">
            <span className="logo-mark">
              <Icon name="wrench" size={19} />
            </span>
            <span className="logo-text">
              Toolshed<strong> Rentals</strong>
            </span>
            <span className="bohol-pill">Bohol, PH</span>
          </Link>

          <nav className="storefront-nav-links">
            <a href="#catalog">Equipment Catalog</a>
            <a href="#branches">Branches</a>
            <a href="#guarantee">Rental Guarantee</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="storefront-nav-actions">
            {session ? (
              <Button onClick={() => navigate('/dashboard')} variant="primary" icon="grid">
                Enter Dashboard
              </Button>
            ) : (
              <>
                <Link to="/login" className="button button-ghost">
                  Sign in
                </Link>
                <Link to="/login" className="button button-primary">
                  Register Account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="storefront-hero">
        <div className="hero-content">
          <span className="hero-eyebrow">
            <Icon name="shield" size={14} /> CERTIFIED COMMERCIAL & DIY EQUIPMENT
          </span>
          <h1>
            Professional Tool & Equipment Rental in <span>Bohol</span>
          </h1>
          <p>
            Reserve high-performance power tools, concrete cutters, jackhammers, and generators across
            Tagbilaran, Panglao, and Tubigon. Same-day counter pickup or direct jobsite delivery.
          </p>

          <div className="hero-search-bar">
            <div className="search-input-wrapper">
              <Icon name="search" size={18} />
              <input
                type="text"
                placeholder="Search tools (e.g. Makita drill, circular saw, rotary hammer)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search equipment"
              />
            </div>
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="hero-branch-select"
              aria-label="Filter branch"
            >
              <option value="All branches">All Bohol Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>
                  {b.name} Branch
                </option>
              ))}
            </select>
            <a href="#catalog" className="button button-primary">
              View Available Tools
            </a>
          </div>

          <div className="hero-trust-row">
            <div className="trust-badge">
              <Icon name="check" size={15} />
              <span>100% Inspected & Safety Tested</span>
            </div>
            <div className="trust-badge">
              <Icon name="clock" size={15} />
              <span>GiST Engine-Level Zero Conflict Booking</span>
            </div>
            <div className="trust-badge">
              <Icon name="truck" size={15} />
              <span>GCash & Site Delivery Available</span>
            </div>
          </div>
        </div>
      </section>

      {/* Equipment Catalog Section */}
      <section id="catalog" className="storefront-catalog">
        <div className="catalog-header">
          <div>
            <span className="eyebrow">EQUIPMENT INVENTORY</span>
            <h2>Available Rental Equipment</h2>
            <p>Select your equipment below. Real-time rates, serial tracking, and instant availability.</p>
          </div>

          <div className="catalog-counter-pill">
            <strong>{filteredItems.length}</strong> items displayed
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="catalog-filters">
          <div className="category-pills">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`category-pill ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="branch-quick-filter">
            <Icon name="pin" size={15} />
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              aria-label="Branch select"
            >
              <option value="All branches">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Catalog Grid */}
        {itemsPending ? (
          <div className="storefront-loading">
            <Icon name="clock" size={24} />
            <span>Loading Bohol equipment catalog…</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-catalog-card">
            <Icon name="box" size={32} />
            <h3>No equipment matched your filters</h3>
            <p>Try clearing your search term or switching to "All Bohol Branches".</p>
            <Button
              variant="secondary"
              onClick={() => {
                setCategoryFilter('All')
                setBranchFilter('All branches')
                setSearchQuery('')
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="catalog-grid">
            {filteredItems.map(item => {
              const isAvailable = item.status === 'Available'
              const isMaint = item.status === 'Maintenance'
              const tone = isAvailable ? 'green' : isMaint ? 'amber' : 'blue'

              return (
                <div key={item.id} className="storefront-item-card">
                  <div className="item-image-wrapper">
                    <img
                      src={
                        item.image ||
                        'https://images.unsplash.com/photo-1504148455328-c376907d081c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
                      }
                      alt={item.name}
                      loading="lazy"
                    />
                    <div className="item-badges-overlay">
                      <Badge tone={tone}>{item.status}</Badge>
                      <span className="branch-tag">
                        <Icon name="pin" size={12} />
                        {item.branch || 'Tagbilaran'}
                      </span>
                    </div>
                  </div>

                  <div className="item-details">
                    <div className="item-category-tag">{item.category}</div>
                    <h3 className="item-name">{item.name}</h3>
                    <p className="item-serial">
                      <Icon name="hash" size={12} /> Asset Serial: {item.serial}
                    </p>

                    <div className="item-financials">
                      <div className="price-block">
                        <span className="price-val">₱{item.price.toLocaleString()}</span>
                        <span className="price-unit">/ day</span>
                      </div>
                      <div className="deposit-note">
                        <small>₱1,000 Refundable Deposit</small>
                      </div>
                    </div>

                    <div className="item-card-actions">
                      <button
                        type="button"
                        className={`button ${isAvailable ? 'button-primary' : 'button-secondary'}`}
                        onClick={() => handleBookClick(item)}
                        style={{ width: '100%' }}
                      >
                        {isAvailable ? 'Rent This Tool' : item.status === 'Maintenance' ? 'Under Maintenance' : 'Currently Rented'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* How it Works / 3-Step Process */}
      <section className="storefront-steps" id="guarantee">
        <div className="section-title-center">
          <span className="eyebrow">SIMPLE 3-STEP WORKFLOW</span>
          <h2>How Equipment Rental Works</h2>
          <p>Renting professional tools in Bohol is fast, safe, and transparent.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-num">01</div>
            <h3>Select & Reserve Online</h3>
            <p>Pick your physical tool, start and end dates, and preferred Bohol pickup branch. Our database locks out conflicting dates instantly.</p>
          </div>
          <div className="step-card">
            <div className="step-num">02</div>
            <h3>Quick Inspection & Handover</h3>
            <p>Visit our counter or opt for jobsite delivery. Review the condition checklist with staff, submit standard ID, and receive your printed slip.</p>
          </div>
          <div className="step-card">
            <div className="step-num">03</div>
            <h3>Return & Deposit Release</h3>
            <p>Return equipment on time to any of our 3 branches. Our technicians run a rapid check and immediately release your refundable security deposit.</p>
          </div>
        </div>
      </section>

      {/* Bohol Branches Section */}
      <section className="storefront-branches" id="branches">
        <div className="section-title-center">
          <span className="eyebrow">OUR LOCATIONS</span>
          <h2>Serving All Major Bohol Districts</h2>
          <p>Strategically located to support island-wide construction, renovation, and resort maintenance.</p>
        </div>

        <div className="branches-grid">
          <div className="branch-info-card">
            <div className="branch-header">
              <span className="branch-pin-icon">
                <Icon name="pin" size={18} />
              </span>
              <div>
                <h3>Tagbilaran Central Depot</h3>
                <small>Main Logistics & Repair Hub</small>
              </div>
            </div>
            <p>CPG North Avenue, Tagbilaran City, Bohol</p>
            <div className="branch-meta">
              <span>Open: 7:00 AM – 6:00 PM (Daily)</span>
              <span>Contact: (038) 412-8665</span>
            </div>
          </div>

          <div className="branch-info-card">
            <div className="branch-header">
              <span className="branch-pin-icon">
                <Icon name="pin" size={18} />
              </span>
              <div>
                <h3>Panglao Island Branch</h3>
                <small>Resort & Commercial Services</small>
              </div>
            </div>
            <p>Panglao Circumferential Road, Tawala, Panglao, Bohol</p>
            <div className="branch-meta">
              <span>Open: 7:30 AM – 5:30 PM (Mon–Sat)</span>
              <span>Contact: (038) 502-9112</span>
            </div>
          </div>

          <div className="branch-info-card">
            <div className="branch-header">
              <span className="branch-pin-icon">
                <Icon name="pin" size={18} />
              </span>
              <div>
                <h3>Tubigon Port Depot</h3>
                <small>North Wharf Logistics Hub</small>
              </div>
            </div>
            <p>Macasarte Street, Tubigon Port Area, Bohol</p>
            <div className="branch-meta">
              <span>Open: 7:00 AM – 5:00 PM (Daily)</span>
              <span>Contact: (038) 508-3340</span>
            </div>
          </div>
        </div>
      </section>

      {/* Guest Prompt Modal */}
      {selectedItemForPrompt && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={e => e.target === e.currentTarget && setSelectedItemForPrompt(null)}
        >
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div>
                <h2>Reserve {selectedItemForPrompt.name}</h2>
                <p>₱{selectedItemForPrompt.price}/day · {selectedItemForPrompt.branch || 'Tagbilaran'}</p>
              </div>
              <button
                className="close-button"
                onClick={() => setSelectedItemForPrompt(null)}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="modal-body">
              <div className="guest-modal-content">
                <div className="guest-modal-icon">
                  <Icon name="shield" size={32} />
                </div>
                <h3>Sign in or Register to Book</h3>
                <p>
                  To guarantee your booking and prevent double reservations, an account is required.
                  Registration takes less than 1 minute.
                </p>

                <div className="guest-modal-features">
                  <div>✓ Instant reservation lock on equipment</div>
                  <div>✓ Track payment and download official rental slips</div>
                  <div>✓ Multi-branch pickup across Bohol</div>
                </div>

                <div className="form-actions" style={{ marginTop: 20 }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setSelectedItemForPrompt(null)}
                  >
                    Continue Browsing
                  </Button>
                  <Button
                    type="button"
                    onClick={() => navigate(`/login?redirect=book&itemId=${selectedItemForPrompt.id}`)}
                  >
                    Sign in to Rent
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="storefront-footer">
        <div className="footer-inner">
          <div className="footer-col brand-col">
            <div className="storefront-logo">
              <span className="logo-mark">
                <Icon name="wrench" size={17} />
              </span>
              <span className="logo-text">Toolshed Rentals</span>
            </div>
            <p>
              Leading equipment and power tool rental network in the province of Bohol. Reliable equipment,
              certified technicians, and transparent pricing.
            </p>
            <small>© {new Date().getFullYear()} Toolshed Rentals Bohol. All rights reserved.</small>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#catalog">Equipment Catalog</a></li>
              <li><a href="#branches">Branch Locations</a></li>
              <li><Link to="/login">Customer Login</Link></li>
              <li><Link to="/login">Staff Portal</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Categories</h4>
            <ul>
              <li><a href="#catalog">Power Tools & Drills</a></li>
              <li><a href="#catalog">Cutters & Grinders</a></li>
              <li><a href="#catalog">Demolition & Hammers</a></li>
              <li><a href="#catalog">Site Generators</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Bohol Support</h4>
            <p>Customer Care: (038) 412-TOOL</p>
            <p>Email: dispatch@toolshed-rentals.ph</p>
            <p>Emergency Replacements: Available 7 days/week</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
