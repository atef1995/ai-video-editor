import React from 'react';
import { Tab, TabGroup, TabList, TabPanels, TabPanel as HeadlessTabPanel } from '@headlessui/react';

export const Tabs = ({ tabs, selectedIndex, onChange, children }) => {
  return (
    <TabGroup selectedIndex={selectedIndex} onChange={onChange}>
      <TabList className="flex space-x-1 rounded-xl bg-gray-800 p-1">
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 ${
                selected
                  ? 'bg-primary-600 shadow'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              {tab.icon && <tab.icon className="h-5 w-5" />}
              <span>{tab.name}</span>
            </div>
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-6">
        {children}
      </TabPanels>
    </TabGroup>
  );
};

export const TabPanel = ({ children, className = "" }) => {
  return (
    <HeadlessTabPanel className={`focus:outline-none ${className}`}>
      {children}
    </HeadlessTabPanel>
  );
};