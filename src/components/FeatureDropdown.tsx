'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FeatureDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  const features = {
    'Proposal Tools': [
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
    ],
    'Planning Tools': [
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
    ],
    'Cost Control': [
      {
        title: 'Budget Tracker',
        description: 'Monitor spend, changes, and updates as the job progresses.'
      },
      {
        title: 'Change Log / Variations',
        description: 'Keep a record of client changes and protect your margin.'
      }
    ],
    'Communication & Delivery': [
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
        className={`absolute left-0 top-full mt-2 w-[600px] bg-black border border-gray-800 rounded-lg shadow-xl transform transition-all duration-200 origin-top-left ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="grid grid-cols-2 gap-6 p-6">
          {Object.entries(features).map(([group, items]) => (
            <div key={group} className="space-y-4">
              <h3 className="text-sm font-medium text-gray-200">{group}</h3>
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.title} className="group/item">
                    <a href="#" className="block space-y-1">
                      <div className="text-sm font-medium text-gray-400 group-hover/item:text-white transition-colors">
                        {item.title}
                      </div>
                      <p className="text-xs text-gray-500 group-hover/item:text-gray-400 transition-colors">
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
  );
};

export default FeatureDropdown; 