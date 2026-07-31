import React, { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';

const PROJECT_SPECS = ["Township", "High Rise", "Mid Rise", "Low Rise", "Independent Floors", "Plots", "Villas"];
const UNIT_SPECS = ["1 BHK", "2 BHK", "3 BHK", "3.5 BHK", "4 BHK", "Penthouse"];
const CLUBHOUSE_CATS = {
  "Sports & Fitness": ["Gymnasium", "Fitness Studio", "CrossFit Zone", "Yoga Deck", "Meditation Room", "Pilates Studio", "Aerobics Studio", "Indoor Cycling Studio", "Squash Court", "Badminton Court", "Table Tennis", "Billiards Room", "Indoor Games Room", "Multi-purpose Court", "Pickleball Court", "Bowling Alley", "Golf Simulator", "Cricket Practice Net"],
  "Aquatic Facilities": ["Swimming Pool", "Kids' Pool", "Infinity Pool", "Lap Pool", "Jacuzzi", "Pool Deck", "Poolside Lounge"],
  "Wellness & Spa": ["Spa", "Sauna", "Steam Room", "Massage Rooms", "Wellness Centre", "Recovery Lounge", "Salon & Grooming Studio"],
  "Entertainment & Recreation": ["Mini Theatre", "Multipurpose Hall", "Party Hall", "Banquet Hall", "Karaoke Room", "Gaming Arcade", "VR Gaming Zone", "Library", "Reading Lounge", "Music Room", "Hobby Room"],
  "Family & Kids": ["Kids' Play Area", "Indoor Kids' Zone", "Creche / Daycare", "Teen Lounge", "Activity Room", "Arts & Crafts Studio", "Learning Centre"],
  "Business & Work": ["Business & Work", "Co-working Space", "Business Centre", "Meeting Rooms", "Conference Room", "Private Work Pods", "Podcast Studio"],
  "Food & Social": ["Café", "Restaurant", "Juice Bar", "Community Kitchen", "Private Dining Room", "Outdoor Dining Deck", "Barbecue Area"],
  "Outdoor Leisure": ["Amphitheatre", "Outdoor Lounge", "Event Lawn", "Party Lawn", "Terrace Garden", "Walking Track", "Viewing Deck", "Zen Garden", "Reflexology Path"],
  "Senior Citizen Amenities": ["Senior Citizens Lounge", "Card Room", "Chess Room", "Wellness Zone", "Walking Track"],
  "Luxury & Premium Amenities": ["Wine Tasting Room", "Cigar Lounge", "Golf Putting Green", "Sky Lounge", "Observatory Deck", "Private Screening Room", "Luxury Guest Suites", "Concierge Desk"]
};
const SAFETY_TIERS = ["3 Tier", "4 Tier", "5 Tier"];
const SUSTAINABILITY = ["Rain water harvesting", "Solar panels", "Sewage Treatment Plant (STP)", "Waste Management", "Air quality monitoring systems", "Indoor air purification systems", "Low-VOC paints and materials", "EV charging stations", "Heat-reflective glass and facades"];
const GREEN_BUILDING = {
  "Core": ["LEED Gold / Platinum", "IGBC Gold / Platinum", "GRIHA 4-Star / 5-Star", "WELL Certified"],
  "Premium differentiators": ["Fitwel", "WiredScore", "SmartScore", "EDGE"],
  "Future-Focused": ["Net Zero Carbon", "Net Zero Energy", "Water Positive Certification"]
};
const THEMES = ["European", "Wellness Centric", "Luxury", "Forest Themed"];

export default function ProjectRequirementsForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    project_specification: [],
    unit_specifications: [],
    clubhouse: {},
    safety_tier: "3 Tier",
    basement_parking_per_unit: 1,
    sustainability: [],
    green_building: {},
    green_area_pct: 70,
    theme: "Luxury",
    front_setback_m: 6.0,
    rear_setback_m: 6.0,
    side_setback_m: 6.0,
    site_analysis: {
      topography: "Flat",
      orientation: "North-Facing",
      soil_type: "Rocky",
      climate: "Hot Desert",
      vegetation: "None",
      views: "Central Green"
    },
    zoning_rules: {
      tower_orientation: "Facing Central Green",
      amenity_layout: "Centralized (Main Park)",
      road_type: "Organic / Curved Loop",
      density_distribution: "Evenly Distributed"
    }
  });

  const [currentStep, setCurrentStep] = useState(1);

  const toggleArrayItem = (field, item) => {
    setFormData(prev => {
      const arr = prev[field];
      if (arr.includes(item)) return { ...prev, [field]: arr.filter(i => i !== item) };
      return { ...prev, [field]: [...arr, item] };
    });
  };

  const toggleCategoryItem = (field, category, item) => {
    setFormData(prev => {
      const catObj = prev[field] || {};
      const arr = catObj[category] || [];
      const newArr = arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
      return { ...prev, [field]: { ...catObj, [category]: newArr } };
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 1: Understanding the Site (Site Analysis)</h3>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Topography */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Topography (Shape of Land)</label>
                <select 
                  value={formData.site_analysis?.topography || "Flat"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    site_analysis: { ...prev.site_analysis, topography: e.target.value }
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Flat">Flat (Ideal for direct construction)</option>
                  <option value="Sloped">Sloped (Requires stepped foundations & drainage planning)</option>
                  <option value="Has Hill / Low Area">Hilly / Low-lying (Affects drainage & placement)</option>
                </select>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Orientation (Plot Direction)</label>
                <select 
                  value={formData.site_analysis?.orientation || "North-Facing"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    site_analysis: { ...prev.site_analysis, orientation: e.target.value }
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="North-Facing">North-Facing (Balanced sunlight)</option>
                  <option value="South-Facing">South-Facing (Maximum direct sun)</option>
                  <option value="East-Facing">East-Facing (Morning sun - Vastu friendly)</option>
                  <option value="West-Facing">West-Facing (Warm evening light)</option>
                </select>
              </div>

              {/* Soil Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Soil Type</label>
                <select 
                  value={formData.site_analysis?.soil_type || "Rocky"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    site_analysis: { ...prev.site_analysis, soil_type: e.target.value }
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Rocky">Rocky (High load bearing capacity)</option>
                  <option value="Sandy">Sandy (Good drainage, needs reinforced footing)</option>
                  <option value="Clay">Clay (Expansive, needs deep specialized foundation)</option>
                </select>
              </div>

              {/* Climate */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Climate Zone</label>
                <select 
                  value={formData.site_analysis?.climate || "Hot Desert"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    site_analysis: { ...prev.site_analysis, climate: e.target.value }
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Hot Desert">Hot Desert (Needs shade & cooling priority)</option>
                  <option value="Rainy Hill Station">Rainy / Hilly (Needs sloped roofs & drainage focus)</option>
                  <option value="Temperate / Moderate">Temperate (Balanced environment)</option>
                  <option value="Tropical / Humid">Tropical (Needs ventilation & high rainfall management)</option>
                </select>
              </div>

              {/* Existing Vegetation */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Vegetation & Water Bodies</label>
                <select 
                  value={formData.site_analysis?.vegetation || "None"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    site_analysis: { ...prev.site_analysis, vegetation: e.target.value }
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="None">Clear Site (No major trees or water bodies)</option>
                  <option value="Old Trees to Preserve">Old Trees (Integrate into central green / parks)</option>
                  <option value="Natural Ponds / Streams">Ponds / Streams (Preserve and frame as central feature)</option>
                </select>
              </div>

              {/* Views */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Surrounding Views & Eyesores</label>
                <select 
                  value={formData.site_analysis?.views || "Central Green"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    site_analysis: { ...prev.site_analysis, views: e.target.value }
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Central Green">Standard (Orientation facing central green)</option>
                  <option value="Scenic Views (Mountains/Water)">Scenic Views (Frame towers toward North/East vistas)</option>
                  <option value="Screen Eyesores (Dump/Highway)">Screen Off Eyesores (Add buffers along highways)</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 2: Project Specifications</h3>
            <div>
              <p className="text-sm font-semibold mb-3">Select Building Types</p>
              <div className="flex flex-wrap gap-3">
                {PROJECT_SPECS.map(spec => (
                  <label key={spec} className={`flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-all ${formData.project_specification.includes(spec) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                    <input type="checkbox" className="hidden" checked={formData.project_specification.includes(spec)} onChange={() => toggleArrayItem('project_specification', spec)} />
                    <span className="text-sm font-medium">{spec}</span>
                    {formData.project_specification.includes(spec) && <CheckCircle2 size={16} />}
                  </label>
                ))}
              </div>
            </div>
            {(formData.project_specification.includes('High Rise') || formData.project_specification.includes('Mid Rise') || formData.project_specification.includes('Independent Floors')) && (
              <div>
                <p className="text-sm font-semibold mb-3">Unit Specifications</p>
                <div className="flex flex-wrap gap-3">
                  {UNIT_SPECS.map(unit => (
                    <label key={unit} className={`flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-all ${formData.unit_specifications.includes(unit) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                      <input type="checkbox" className="hidden" checked={formData.unit_specifications.includes(unit)} onChange={() => toggleArrayItem('unit_specifications', unit)} />
                      <span className="text-sm font-medium">{unit}</span>
                      {formData.unit_specifications.includes(unit) && <CheckCircle2 size={16} />}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 3: Define Clubhouse</h3>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
              {Object.entries(CLUBHOUSE_CATS).map(([category, items]) => (
                <div key={category} className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-sm font-bold text-slate-700 mb-3">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => {
                      const isSelected = (formData.clubhouse[category] || []).includes(item);
                      return (
                        <label key={item} className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-emerald-300'}`}>
                          <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleCategoryItem('clubhouse', category, item)} />
                          <span className="text-xs font-medium">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 4: Safety, Security & Basement</h3>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Safety & Security Tier</label>
                <select 
                  value={formData.safety_tier} 
                  onChange={(e) => setFormData(prev => ({ ...prev, safety_tier: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {SAFETY_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-2">Security checkpoints will be marked on entry, parkings, and tower lobbies accordingly.</p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Basement Parking per Unit</label>
                <input 
                  type="number" 
                  min="0" step="0.5" 
                  value={formData.basement_parking_per_unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, basement_parking_per_unit: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 5: Sustainability & Green Design</h3>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-sm font-bold text-slate-700 mb-3">Sustainability Features</p>
              <div className="flex flex-wrap gap-2">
                {SUSTAINABILITY.map(item => (
                  <label key={item} className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition-all ${formData.sustainability.includes(item) ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-300'}`}>
                    <input type="checkbox" className="hidden" checked={formData.sustainability.includes(item)} onChange={() => toggleArrayItem('sustainability', item)} />
                    <span className="text-xs font-medium">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(GREEN_BUILDING).map(([category, items]) => (
                <div key={category} className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-sm font-bold text-slate-700 mb-3">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => {
                      const isSelected = (formData.green_building[category] || []).includes(item);
                      return (
                        <label key={item} className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition-all ${isSelected ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-300'}`}>
                          <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleCategoryItem('green_building', category, item)} />
                          <span className="text-xs font-medium">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 6: Zoning & Layout Preferences</h3>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6">
              {/* Tower Orientation */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Residential Tower Orientation</label>
                <select 
                  value={formData.zoning_rules.tower_orientation} 
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    zoning_rules: { ...prev.zoning_rules, tower_orientation: e.target.value } 
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Facing Central Green">Facing Central Green (Optimal views)</option>
                  <option value="North-South Facing">North-South Facing (Ideal sunlight/ventilation)</option>
                  <option value="Vastu / East-Facing">Vastu / East-Facing (Traditional orientation)</option>
                  <option value="No Preference">No Preference</option>
                </select>
              </div>

              {/* Amenity & Green Layout */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Zoning / Amenity Layout</label>
                <select 
                  value={formData.zoning_rules.amenity_layout} 
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    zoning_rules: { ...prev.zoning_rules, amenity_layout: e.target.value } 
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Centralized (Main Park)">Centralized (Facilities clustered in the center)</option>
                  <option value="Decentralized pockets">Decentralized pockets (Spread throughout the township)</option>
                  <option value="Peripheral Buffer">Peripheral Buffer (Amenities along boundary lines)</option>
                </select>
              </div>

              {/* Road Network Type */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Road Network Style</label>
                <select 
                  value={formData.zoning_rules.road_type} 
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    zoning_rules: { ...prev.zoning_rules, road_type: e.target.value } 
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Organic / Curved Loop">Organic / Curved Loop (Flowing curved loop road)</option>
                  <option value="Linear Boulevard">Linear Boulevard (Grand straight central entry road)</option>
                  <option value="Grid-iron">Grid-iron (Strict perpendicular grid layout)</option>
                </select>
              </div>

              {/* Density & Spacing */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Spacing & Density Preference</label>
                <select 
                  value={formData.zoning_rules.density_distribution} 
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    zoning_rules: { ...prev.zoning_rules, density_distribution: e.target.value } 
                  }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="Evenly Distributed">Evenly Distributed (Balanced spacing across the plot)</option>
                  <option value="High Open Space (Clustered)">High Open Space (Towers clustered to maximize green area)</option>
                  <option value="Concentrated Near Center">Concentrated Near Center (Towers closer to central park)</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 7: Global Settings & Review</h3>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Green Area %</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" min="30" max="90" step="5"
                    value={formData.green_area_pct}
                    onChange={(e) => setFormData(prev => ({ ...prev, green_area_pct: parseInt(e.target.value) }))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md">{formData.green_area_pct}%</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Setback Dimensions (m)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Front Setback</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.front_setback_m}
                      onChange={(e) => setFormData(prev => ({ ...prev, front_setback_m: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Rear Setback</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.rear_setback_m}
                      onChange={(e) => setFormData(prev => ({ ...prev, rear_setback_m: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Sides Setback</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.side_setback_m}
                      onChange={(e) => setFormData(prev => ({ ...prev, side_setback_m: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Theme</label>
                <select 
                  value={formData.theme} 
                  onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {THEMES.map(theme => <option key={theme} value={theme}>{theme}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <p className="text-sm text-indigo-800 font-medium text-center">
                AI Layout Generator will now generate a clash-free master plan matching all these exact specifications.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
      <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Project Requirements</h2>
          <p className="text-sm text-slate-400 mt-1">Configure site features for AI generation</p>
        </div>
        <div className="text-sm font-bold text-slate-300">
          Step {currentStep} of 7
        </div>
      </div>
      
      <div className="p-8">
        {renderStepContent()}
      </div>

      <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center">
        <Button 
          variant="secondary" 
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
        >
          Back
        </Button>
        {currentStep < 7 ? (
          <Button variant="primary" onClick={() => setCurrentStep(prev => Math.min(7, prev + 1))}>
            Continue <ArrowRight size={16} className="ml-2" />
          </Button>
        ) : (
          <Button variant="success" onClick={() => onSubmit(formData)}>
            Generate Master Plan
          </Button>
        )}
      </div>
    </div>
  );
}
