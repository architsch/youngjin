// Note: The purpose of this module is to prevent circular dependency errors
// which occur due to static ES module imports.

const dependencyInjector: {[key: string]: any} = {};

export default dependencyInjector;