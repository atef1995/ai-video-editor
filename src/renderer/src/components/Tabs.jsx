import React from "react";
import {
  Tab,
  TabGroup,
  TabList,
  TabPanels,
  TabPanel as HeadlessTabPanel,
} from "@headlessui/react";

export const Tabs = ({ tabs, selectedIndex, onChange, children }) => {
  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={onChange}
      className="h-full w-full my-4"
    >
      <div className="flex justify-center">
        <TabList className="flex space-x-3 bg-gray-800 p-2 rounded-full border border-gray-700">
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              className={({ selected }) =>
                `flex items-center justify-center w-full h-full p-4 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none ${
                  selected
                    ? "bg-primary-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`
              }
            >
              <tab.icon className="h-5 w-5 mr-2" />
              <span>{tab.name}</span>
            </Tab>
          ))}
        </TabList>
      </div>
      <TabPanels className="mt-12">{children}</TabPanels>
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
