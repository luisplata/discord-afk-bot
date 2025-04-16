const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, 'data.json');

const db = {
  get: (collectionName, id) => {
    try {
      const dbData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      const collection = dbData[collectionName];
      if (!collection) return null;
      return collection.find(doc => doc.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  update: (collectionName, id, data) => {
    try {
      const dbData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      const collection = dbData[collectionName];
      if (!collection) return false;

      const index = collection.findIndex(doc => doc.id === id);
      if (index === -1) return false;

      collection[index] = { ...collection[index], ...data };
      fs.writeFileSync(dataFilePath, JSON.stringify(dbData, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  },

  save: (collectionName, id, data) => {
    try {
      let dbData = {};
      try {
        dbData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      } catch (readError) {
        // File doesn't exist or is invalid JSON, start with an empty object
      }

      if (!dbData[collectionName]) {
        dbData[collectionName] = [];
      }

      const existingIndex = dbData[collectionName].findIndex(doc => doc.id === id);
      if (existingIndex !== -1) {
        // If exists, update instead of creating new
        dbData[collectionName][existingIndex] = { ...dbData[collectionName][existingIndex], ...data };
      } else {
        dbData[collectionName].push({ id, ...data });
      }

      fs.writeFileSync(dataFilePath, JSON.stringify(dbData, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  },
};

module.exports = db;