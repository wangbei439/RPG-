const { encrypt, decrypt, maskSecret } = require('../utils/encryption');

describe('Encryption - 加密工具', () => {
    describe('encrypt/decrypt - 加密解密', () => {
        test('加密后的字符串应能正确解密', () => {
            const plaintext = 'sk-1234567890abcdef';
            const encrypted = encrypt(plaintext);
            expect(encrypted).not.toBe(plaintext);
            expect(typeof encrypted).toBe('string');
            expect(decrypt(encrypted)).toBe(plaintext);
        });

        test('应能加密和解密中文文本', () => {
            const plaintext = '这是一个秘密密钥🔑';
            const encrypted = encrypt(plaintext);
            expect(decrypt(encrypted)).toBe(plaintext);
        });

        test('应能加密和解密JSON字符串', () => {
            const plaintext = JSON.stringify({ apiKey: 'sk-test', model: 'gpt-4' });
            const encrypted = encrypt(plaintext);
            expect(decrypt(encrypted)).toBe(plaintext);
        });

        test('加密长字符串应正常工作', () => {
            const plaintext = 'a'.repeat(10000);
            const encrypted = encrypt(plaintext);
            expect(decrypt(encrypted)).toBe(plaintext);
        });

        test('相同明文多次加密应产生不同密文', () => {
            const plaintext = 'same-input';
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);
            // Due to random IV, encrypted values should differ
            expect(encrypted1).not.toBe(encrypted2);
            // But both should decrypt to the same value
            expect(decrypt(encrypted1)).toBe(plaintext);
            expect(decrypt(encrypted2)).toBe(plaintext);
        });

        test('解密无效的Base64应返回null', () => {
            expect(decrypt('not-valid-base64!!!')).toBeNull();
        });

        test('解密空字符串应返回null', () => {
            expect(decrypt('')).toBeNull();
            expect(decrypt(null)).toBeNull();
            expect(decrypt(undefined)).toBeNull();
        });

        test('加密空字符串应抛出错误', () => {
            expect(() => encrypt('')).toThrow();
            expect(() => encrypt(null)).toThrow();
        });
    });

    describe('maskSecret - 敏感信息遮蔽', () => {
        test('应遮蔽中等长度的密钥', () => {
            expect(maskSecret('sk-1234567890abcdef')).toBe('sk-1***********cdef');
        });

        test('短字符串应返回****', () => {
            expect(maskSecret('short')).toBe('****');
            expect(maskSecret('12345678')).toBe('****');
        });

        test('9字符字符串应部分遮蔽', () => {
            expect(maskSecret('123456789')).toBe('1234*6789');
        });

        test('null/undefined/空应返回****', () => {
            expect(maskSecret(null)).toBe('****');
            expect(maskSecret(undefined)).toBe('****');
            expect(maskSecret('')).toBe('****');
        });
    });
});
