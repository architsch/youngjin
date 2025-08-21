// Note: The purpose of this module is to prevent circular dependency errors
// which occur due to static ES module imports.

const services: {[key: string]: any} = {};

const ServiceLocatorUtil =
{
    add: (key: string, service: any): void =>
    {
        if (services[key] != undefined)
            throw new Error(`Service with key '${key}' already exists.`);
        services[key] = service;
    },
    get: (key: string): any =>
    {
        return services[key];
    },
}

export default ServiceLocatorUtil;