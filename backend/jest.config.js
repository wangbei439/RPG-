module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'engine/**/*.js',
        'utils/**/*.js',
        'database.js',
        '!**/node_modules/**'
    ]
};
