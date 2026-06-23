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
    theme: "Luxury"
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
            <h3 className="text-lg font-bold text-slate-800">Step 3: Project Specifications</h3>
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
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 4: Define Clubhouse</h3>
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
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 5 & 6: Safety, Security & Basement</h3>
            
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
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Step 7 & 8: Sustainability & Green Design</h3>
            
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
      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Global Settings & Review</h3>
            
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
                Claude AI will now generate a clash-free master plan matching all these exact specifications.
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
          Step {currentStep} of 5
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
        {currentStep < 5 ? (
          <Button variant="primary" onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}>
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
