import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Sparkles, 
  Layout, 
  LineChart, 
  Box, 
  ShieldCheck, 
  Building, 
  MapPin, 
  Database,
  Play
} from 'lucide-react';
import Button from '../components/ui/Button';

export default function Landing() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/projects');
  };

  const features = [
    {
      title: "Generative Site Design",
      description: "Automated tower and amenity layouts.",
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Multi-Objective Optimizer",
      description: "Optimal balance of saleable area and bylaws.",
      image: "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Photorealistic 3D Renders",
      description: "Real-time visual rendering.",
      image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Real-time Compliance",
      description: "Instant setback and zoning checks.",
      image: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80"
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 flex flex-col font-sans antialiased selection:bg-neutral-200 selection:text-neutral-900">
      {/* Header/Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#fafafa]/35 backdrop-blur-md border-b border-neutral-200/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="bg-black text-white p-2 rounded">
              <Building size={20} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-neutral-950">
              MasterPlan <span className="text-neutral-500 font-normal">AI</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
            <a href="#features" className="hover:text-neutral-950 transition-colors duration-200">Features</a>
            <a href="#solutions" className="hover:text-neutral-950 transition-colors duration-200">Solutions</a>
            <a href="#pricing" className="hover:text-neutral-950 transition-colors duration-200">Pricing</a>
            <a href="#resources" className="hover:text-neutral-950 transition-colors duration-200">Resources</a>
            <a href="#about" className="hover:text-neutral-950 transition-colors duration-200">About</a>
            <a href="#contact" className="hover:text-neutral-950 transition-colors duration-200">Contact</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleGetStarted}
              className="hidden sm:inline-flex text-sm font-semibold text-neutral-600 hover:text-neutral-950 transition-colors py-2 px-4"
            >
              Sign In
            </button>
            <button 
              onClick={handleGetStarted}
              className="bg-black hover:bg-neutral-800 text-white font-semibold py-2.5 px-4 rounded shadow transition-all hover:scale-[1.02] flex items-center gap-1 text-sm"
            >
              Get Started <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-start overflow-hidden pt-20">
        {/* Full-bleed Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80" 
            alt="Premium Architectural Design"
            className="w-full h-full object-cover filter brightness-[1.0] contrast-[1.0] grayscale-[5%]"
          />
          {/* Custom fade overlay: bright white/light fade on the left, completely clean & transparent on the right 70% */}
          <div 
            className="absolute inset-0"
            style={{ 
              background: 'linear-gradient(to right, rgba(250,250,250,1) 0%, rgba(250,250,250,0.85) 30%, rgba(250,250,250,0.4) 45%, rgba(250,250,250,0) 60%)' 
            }} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#fafafa] via-transparent to-white/10" />
        </div>

        {/* Hero Content & Tool References */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full text-left pt-16 pb-12">
          <div className="space-y-6 max-w-xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-neutral-950 leading-tight">
              Architecting the Future of{" "}
              <span className="font-semibold block text-neutral-500 mt-1">
                Real Estate Layouts
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-neutral-600 font-normal leading-relaxed max-w-md">
              Generate, optimize, and render photorealistic residential and commercial site layouts instantly with our developer-first planning suite.
            </p>

            <div className="flex flex-row items-center gap-6 pt-2">
              <button 
                onClick={handleGetStarted}
                className="bg-black hover:bg-neutral-800 text-white font-semibold py-2.5 px-6 text-xs rounded transition-all hover:scale-[1.02] flex items-center gap-1.5"
              >
                Start Designing <ArrowRight size={14} />
              </button>
              <button 
                onClick={handleGetStarted}
                className="group text-neutral-600 hover:text-neutral-950 font-medium text-xs transition-colors py-2 flex items-center gap-1.5 relative"
              >
                Watch Demo
                <span className="absolute bottom-1.5 left-0 w-0 h-[1px] bg-black group-hover:w-full transition-all duration-300" />
              </button>
            </div>
          </div>

          {/* 2D & 3D Tool References */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-neutral-200 mt-12 max-w-xl">
            <div className="group cursor-pointer" onClick={handleGetStarted}>
              <span className="text-[9px] uppercase tracking-widest text-neutral-450 font-bold block mb-1">01 / Planning Engine</span>
              <h4 className="text-xs font-bold text-neutral-900 group-hover:text-neutral-600 transition-colors flex items-center gap-1.5">
                2D Master Plan Maker 
                <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </h4>
              <p className="text-[11px] text-neutral-600 mt-1.5 leading-relaxed">CAD canvas for parcel layouts, setbacks, and local zoning compliance.</p>
            </div>

            <div className="group cursor-pointer" onClick={handleGetStarted}>
              <span className="text-[9px] uppercase tracking-widest text-neutral-450 font-bold block mb-1">02 / Visualization</span>
              <h4 className="text-xs font-bold text-neutral-900 group-hover:text-neutral-600 transition-colors flex items-center gap-1.5">
                3D Master Plan Maker 
                <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </h4>
              <p className="text-[11px] text-neutral-600 mt-1.5 leading-relaxed">Volumetric tower extrusions, real-time shadow analyses, and rendering.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-24 bg-[#fafafa] relative border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs font-bold tracking-widest text-neutral-500 uppercase">Core Capabilities</h2>
            <h3 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-900">Powering developers from coordinates to renders</h3>
            <p className="text-neutral-600 text-base sm:text-lg">
              Engineered with advanced structural solvers and procedural graphics to streamline complex layouts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-neutral-200/60 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_rgba(0,0,0,0.06)] hover:border-neutral-300/80 group flex flex-col justify-between h-full cursor-pointer"
                onClick={handleGetStarted}
              >
                <div>
                  <div className="h-44 w-full overflow-hidden bg-neutral-50 rounded-xl relative mb-5">
                    <img 
                      src={feature.image} 
                      alt={feature.title} 
                      className="w-full h-full object-cover brightness-[0.98] group-hover:scale-[1.03] transition-all duration-700 ease-out"
                    />
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-400 font-bold block mb-1">0{idx + 1} / MODULE</span>
                    <h4 className="text-sm font-semibold text-neutral-950 mb-1.5 tracking-tight group-hover:text-black transition-colors">{feature.title}</h4>
                    <p className="text-neutral-500 text-xs leading-relaxed font-normal">{feature.description}</p>
                  </div>
                </div>
                <div className="px-1 pt-6 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-neutral-950 transition-colors">
                  <span>Explore Module</span>
                  <ArrowRight size={11} className="translate-x-0 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Showcase Section (2D Maps & 3D Videos) */}
      <section className="py-24 bg-white border-t border-b border-neutral-200/60 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs font-bold tracking-widest text-neutral-500 uppercase">Live Showcase</h2>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">Interactive CAD Maps & 3D Volumetrics</h3>
            <p className="text-neutral-600 text-xs sm:text-sm">
              Explore the difference between our high-fidelity 2D planning maps and real-time 3D simulator rendering.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* 2D Masterplan Map Card */}
            <div className="bg-[#fafafa] border border-neutral-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              <div className="h-64 sm:h-80 w-full overflow-hidden bg-neutral-100 relative">
                <img 
                  src="/free-assets/central_lawn_topdown.png" 
                  alt="2D Masterplan Map" 
                  className="w-full h-full object-cover brightness-95 hover:brightness-100 transition-all duration-300"
                />
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded">
                  2D Site Blueprint
                </div>
              </div>
              <div className="p-8 space-y-3">
                <h4 className="text-lg font-bold text-neutral-900">Top-Down 2D Masterplan Map</h4>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Generate CAD-grade site layout maps with parcel boundaries, roads, setbacks, zoning limits, and walkability paths.
                </p>
              </div>
            </div>

            {/* 3D Masterplan Video Card */}
            <div className="bg-[#fafafa] border border-neutral-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              <div className="h-64 sm:h-80 w-full overflow-hidden bg-neutral-100 relative">
                <video 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  poster="/free-assets/building_mixed_use.png"
                  className="w-full h-full object-cover brightness-95 hover:brightness-100 transition-all duration-300"
                >
                  <source src="https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-building-exterior-41553-large.mp4" type="video/mp4" />
                </video>
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded">
                  3D Simulation Render
                </div>
              </div>
              <div className="p-8 space-y-3">
                <h4 className="text-lg font-bold text-neutral-900">Real-Time 3D Volumetric Video</h4>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Simulate shadow casting, tower volumes, direct sunlight indexes, and compile photo-realistic 3D walkthrough videos of developer sites.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="py-16 bg-white border-t border-b border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl sm:text-5xl font-black text-neutral-950">10k+</div>
            <div className="text-neutral-500 text-xs sm:text-sm mt-1 uppercase tracking-wider font-semibold">Plans Generated</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-black text-neutral-950">85%</div>
            <div className="text-neutral-500 text-xs sm:text-sm mt-1 uppercase tracking-wider font-semibold">Time Saved</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-black text-neutral-950">&lt; 3s</div>
            <div className="text-neutral-500 text-xs sm:text-sm mt-1 uppercase tracking-wider font-semibold">Solver Response</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-black text-neutral-950">100%</div>
            <div className="text-neutral-500 text-xs sm:text-sm mt-1 uppercase tracking-wider font-semibold">Zoning Compliant</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#fafafa] relative overflow-hidden border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6 text-left">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-950 tracking-tight leading-tight">
                Ready to design your next landmark project?
              </h2>
              <p className="text-neutral-600 text-xs sm:text-sm max-w-md leading-relaxed">
                Empower your development teams with instant site feasibility assessments, Pareto-optimal configurations, and photorealistic high-fidelity visuals.
              </p>
              <div className="pt-2">
                <button 
                  onClick={handleGetStarted}
                  className="bg-black hover:bg-neutral-800 text-white font-semibold py-3 px-6 text-xs rounded transition-all hover:scale-[1.02] flex items-center gap-1.5"
                >
                  Access Projects Dashboard <ArrowRight size={14} />
                </button>
              </div>
            </div>
            {/* Right Visual */}
            <div className="h-64 sm:h-80 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 relative">
              <img 
                src="https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80" 
                alt="Architectural Feasibility" 
                className="w-full h-full object-cover brightness-95 hover:brightness-100 transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#fafafa]/50 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-neutral-200 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-neutral-100 p-1.5 rounded text-neutral-800">
              <Building size={16} />
            </div>
            <span className="font-bold text-sm tracking-tight text-neutral-950">MasterPlan AI</span>
          </div>

          <div className="flex gap-8 text-xs text-neutral-500">
            <span className="hover:text-neutral-800 cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-neutral-800 cursor-pointer transition-colors">Terms of Service</span>
            <span className="hover:text-neutral-800 cursor-pointer transition-colors">Feasibility SLA</span>
            <span className="hover:text-neutral-800 cursor-pointer transition-colors">Contact</span>
          </div>

          <p className="text-xs text-neutral-500">
            &copy; {new Date().getFullYear()} MasterPlan AI Technologies Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
