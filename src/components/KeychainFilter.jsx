import React, { useState } from 'react';

const KeychainFilter = ({ keychains, selectedKeychains, onKeychainChange, minCharmValue, onMinCharmValueChange }) => {
  const [activeTab, setActiveTab] = useState('small-arms');

  const charmSets = {
    'small-arms': {
      name: 'Small Arms',
      charms: [
        { name: 'Hot Wurst', value: 65.0 },
        { name: 'Baby Karat CT', value: 45.0 },
        { name: 'Semi-Precious', value: 50.0 },
        { name: 'Titanium AWP', value: 15.0 },
        { name: "Lil' Squirt", value: 10.00 },
        { name: 'Die-cast AK', value: 10.00 },
        { name: 'Glamour Shot', value: 3.00 },
        { name: 'Hot Hands', value: 2.50 },
        { name: 'POP Art', value: 2.50 },
        { name: 'Disco MAC', value: 2.00 },
        { name: "Baby's AK", value: 0.80 },
        { name: 'Pocket AWP', value: 0.5 },
        { name: 'Whittle Knife', value: 0.5 },
        { name: 'Backsplash', value: 0.24 },
        { name: 'Stitch-Loaded', value: 0.25 },
        { name: "Lil' Cap Gun", value: 0.25 }
      ]
    },
    'missing-link': {
      name: 'Missing Link',
      charms: [
        { name: 'Hot Howl', value: 85.0 },
        { name: 'Hot Wurst', value: 60.0 },
        { name: 'Diamond Dog', value: 30.0 },
        { name: "Lil' Monster", value: 20.0 },
        { name: 'Diner Dog', value: 15.00 },
        { name: "Lil' Teacup", value: 5.0 },
        { name: "Chicken Lil'", value: 4.50 },
        { name: "That's Bananas", value: 3.50 },
        { name: "Lil' Whiskers", value: 2.50 },
        { name: "Lil' Sandy", value: 2.50 },
        { name: "Lil' Squatch", value: 1.50 },
        { name: "Lil' SAS", value: 1.00 },
        { name: 'Hot Sauce', value: 0.50 },
        { name: "Pinch O' Salt", value: 0.50 },
        { name: 'Big Kev', value: 0.50 },
        { name: "Lil' Crass", value: 0.40 },
        { name: "Lil' Ava", value: 0.40 }
      ]
    },
    'missing-link-community': {
      name: 'Missing Link Community',
      charms: [
        { name: "Lil' Boo", value: 100.00 },
        { name: "Lil' Eldritch", value: 50.00 },
        { name: 'Quick Silver', value: 45.00 },
        { name: "Lil' Serpent", value: 35.00 },
        { name: "Lil' Hero", value: 20.00 },
        { name: 'Piñatita', value: 15.00 },
        { name: "Lil' Happy", value: 12.00 },
        { name: "Lil' Chirp", value: 12.00 },
        { name: "Lil' Prick", value: 8.00 },
        { name: 'Pocket Pop', value: 3.50 },
        { name: "Lil' Moments", value: 3.00 },
        { name: 'Magmatude', value: 2.50 },
        { name: "Lil' Goop", value: 2.25 },
        { name: "Lil' Buns", value: 1.50 },
        { name: 'Hang Loose', value: 1.25 },
        { name: "Lil' No. 2", value: 0.50 },
        { name: "Lil' Cackle", value: 0.35 },
        { name: 'Dead Weight', value: 0.30 },
        { name: "Lil' Baller", value: 0.30 },
        { name: "Lil' Smokey", value: 0.25 },
        { name: "Lil' Tusk", value: 0.20 },
        { name: "Lil' Vino", value: 0.20 },
        { name: "Lil' Curse", value: 0.20 }
      ]
    },
    'dr-boom': {
      name: 'Dr Boom',
      charms: [
        { name: 'Butane Buddy', value: 100 },
        { name: 'Glitter Bomb', value: 60.0 },
        { name: '8 Ball IGL', value: 50.0 },
        { name: "Lil' Ferno", value: 35.0 },
        { name: "Lil' Eco", value: 13.00 },
        { name: "Lil' Yeti", value: 13.00 },
        { name: 'Flash Bomb', value: 10.00 },
        { name: 'Eye of Ball', value: 8.00 },
        { name: 'Hungry Eyes', value: 7.00 },
        { name: "Lil' Bloody", value: 2.50 },
        { name: "Lil' Dumplin'", value: 2.00 },
        { name: 'Dr. Brian', value: 1.50 },
        { name: "Lil' Chomper", value: 1.00 },
        { name: "Lil' Facelift", value: 1.00 },
        { name: 'Big Brain', value: 1.00 },
        { name: 'Bomb Tag', value: 1.00 },
        { name: "Lil' Zen", value: 0.50 },
        { name: 'Splatter Cat', value: 0.25 },
        { name: 'Gritty', value: 0.20 },
        { name: 'Whittle Guy', value: 0.20 },
        { name: 'Fluffy', value: 0.20 },
        { name: 'Biomech', value: 0.20 }
      ]
    },
    'austin-major': {
      name: 'Austin Major',
      charms: []
    }
  };

  const currentCharms = charmSets[activeTab].charms;
  const totalSelected = currentCharms.filter(charm => selectedKeychains[charm.name]).length;

  const handleSelectAll = () => {
    const updates = {};
    currentCharms.forEach(charm => {
      updates[charm.name] = true;
    });
    onKeychainChange(updates);
  };

  const handleSelectNone = () => {
    const updates = {};
    currentCharms.forEach(charm => {
      updates[charm.name] = false;
    });
    onKeychainChange(updates);
  };

  const getCharmColorClass = (value) => {
    if (value >= 35) return 'text-red-400 border-red-400';
    if (value >= 8) return 'text-pink-400 border-pink-400';
    if (value >= 1) return 'text-purple-400 border-purple-400';
    return 'text-blue-400 border-blue-400';
  };

  return (
    <div className="keychain-filter bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center mb-4">
        <span className="text-blue-400 mr-2">🔗</span>
        <h3 className="text-blue-400 font-semibold">KEYCHAIN FILTER</h3>
      </div>

      <div className="mb-4">
        <label className="text-gray-300 text-sm block mb-2">
          Minimum Charm Value (% of Item Value)
        </label>
        <div className="flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={minCharmValue}
            onChange={(e) => onMinCharmValueChange(parseFloat(e.target.value))}
            className="flex-1 mr-3"
          />
          <span className="text-blue-400 text-sm font-semibold">
            {minCharmValue}% of market value
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">
              Target Keychains ({totalSelected}/{currentCharms.length})
            </span>
            <button className="text-gray-400 hover:text-white">▲</button>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(charmSets).map(([key, set]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  activeTab === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {set.name}
              </button>
            ))}
          </div>

          <div className="mb-3">
            <span className="text-gray-400 text-sm block mb-2">
              Select which keychains to monitor
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                All
              </button>
              <button
                onClick={handleSelectNone}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 transition-colors"
              >
                None
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {currentCharms.map((charm) => (
              <div
                key={charm.name}
                className={`flex items-center justify-between p-2 rounded border ${getCharmColorClass(charm.value)}`}
              >
                <label className="flex items-center cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={selectedKeychains[charm.name] || false}
                    onChange={(e) => onKeychainChange({ [charm.name]: e.target.checked })}
                    className="mr-3"
                  />
                  <span className="text-white">{charm.name}</span>
                </label>
                <span className={`font-semibold ${getCharmColorClass(charm.value).split(' ')[0]}`}>
                  {charm.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeychainFilter;