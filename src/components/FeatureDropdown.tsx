'use client';

import { useState } from 'react';
import { ChevronDown, FileText, Calendar, PieChart, Send } from 'lucide-react';

const FeatureDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  const features = {
    'Proposal Tools': {
      icon: <FileText className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />,
      items: [
        {
          title: 'Quick Quote Builder',
          description: 'Build detailed proposals fast—line items, quantities, and pricing in one place.'
        },
        {
          title: 'Custom Terms & Conditions',
          description: 'Set your own T&Cs once and reuse them across jobs.'
        },
        {
          title: 'Capability Statement Builder',
          description: 'Showcase your expertise and experience in every proposal.'
        }
      ]
    },
    'Planning Tools': {
      icon: <Calendar className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />,
      items: [
        {
          title: 'Visual Programme Editor',
          description: 'Create clear project timelines without spreadsheets.'
        },
        {
          title: 'Phase & Milestone Mapping',
          description: 'Break down jobs into manageable chunks and key dates.'
        },
        {
          title: 'Job Overview Dashboard',
          description: 'See all active and upcoming jobs at a glance.'
        }
      ]
    },
    'Cost Control': {
      icon: <PieChart className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />,
      items: [
        {
          title: 'Budget Tracker',
          description: 'Monitor spend, changes, and updates as the job progresses.'
        },
        {
          title: 'Change Log / Variations',
          description: 'Keep a record of client changes and protect your margin.'
        }
      ]
    },
    'Communication & Delivery': {
      icon: <Send className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />,
      items: [
        {
          title: 'Client-Ready PDFs',
          description: 'Send branded, professional proposals instantly.'
        },
        {
          title: 'One-Tap Updates',
          description: 'Update job status or key info in seconds, from anywhere.'
        },
        {
          title: 'Mobile-First Workflow',
          description: 'Built to work wherever you are—on-site or on the move.'
        }
      ]
    }
  };

  return (
    <div className="relative group">
      <button
        onMouseEnter={() => setIsOpen(true)}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-gray-500 hover:text-gray-300 transition-colors duration-200"
      >
        <span>Features</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      <div
        onMouseLeave={() => setIsOpen(false)}
        className={`fixed inset-0 top-16 z-50 bg-[#000000] transform transition-all duration-200 ${
          isOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="relative z-50 max-w-7xl mx-auto px-8 py-16 bg-[#000000] text-left">
          <div className="grid grid-cols-4 gap-8">
            {Object.entries(features).map(([group, { icon, items }]) => (
              <div key={group} className="group text-left">
                <div className="flex items-center space-x-2 mb-6">
                  {icon}
                  <h3 className="text-base font-medium text-gray-200 group-hover:text-white transition-colors">{group}</h3>
                </div>
                <ul className="space-y-6 text-left">
                  {items.map((item) => (
                    <li key={item.title} className="group/item">
                      <a href="#" className="block text-left">
                        <div className="text-sm font-medium text-gray-400 group-hover/item:text-white transition-colors mb-1">
                          {item.title}
                        </div>
                        <p className="text-xs text-gray-500 group-hover/item:text-gray-400 transition-colors leading-relaxed">
                          {item.description}
                        </p>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureDropdown; 