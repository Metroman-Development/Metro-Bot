const truncate = (obj, { maxLength = 100, maxDepth = 5, maxArrayLength = 10 } = {}, _depth = 0, _seen = new WeakSet()) => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (_seen.has(obj)) {
        return '[Circular]';
    }

    if (typeof obj === 'object') {
        _seen.add(obj);
    }

    if (_depth > maxDepth) {
        return '[Max Depth]';
    }

    if (typeof obj === 'string') {
        if (obj.length > maxLength) {
            return obj.substring(0, maxLength) + '...';
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        if (obj.length > maxArrayLength) {
            const truncated = obj.slice(0, maxArrayLength).map(item => truncate(item, { maxLength, maxDepth, maxArrayLength }, _depth + 1, _seen));
            truncated.push(`... (${obj.length - maxArrayLength} more items)`);
            return truncated;
        }
        return obj.map(item => truncate(item, { maxLength, maxDepth, maxArrayLength }, _depth + 1, _seen));
    }

    if (typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = truncate(obj[key], { maxLength, maxDepth, maxArrayLength }, _depth + 1, _seen);
            }
        }
        return newObj;
    }

    return obj;
};

module.exports = {
    truncate,
};
