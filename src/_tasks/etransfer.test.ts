import { JSDOM } from 'jsdom';
import { createReadStream } from 'fs';
import { join } from 'path';
import EmlParser from 'eml-parser';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';

// Mock Task to avoid importing
type Task = {
    log(level: string, message: string): void;
}

// Copy the function to test from src/_tasks/etransfer.ts to avoid importing
function parseEtransferEmailFromDOM(document: any, log: Task["log"]): { accountid: string; amount: string; } {
    let accountid: string | undefined = undefined;
    let amount: string | undefined = undefined;

    // Find element that contains REFILL using xpath
    const message = document.evaluate("//p[contains(text(), 'REFILL')]", document, null, 9, null).singleNodeValue.textContent.trim();
    const amountText = document.evaluate("//*[contains(text(), '$')]", document, null, 9, null).singleNodeValue.textContent.trim();

    // Make sure both are not the same one to prevent amounts being places in the message
    if ( message === amountText && typeof message === "string") {
        throw "message and amount text are the same"
    }

    // Parse message to get accountid
    const delims = [
        ':',
        '&',
    ]

    for (const delim of delims) {
        if ((message.toLowerCase().includes(`refill${delim}`))) {
            accountid = message.toLowerCase().split(`refill${delim}`)[1]?.trim();
        }
    }

    if (accountid === undefined && accountid !== ""){
        throw 'accountid is undefined';
    }

    // Parse amountText to get amount
    amount = amountText.split('$')[1].split('(CAD')[0]?.trim();

    if (amount === undefined && amount !==""){
        throw 'amount is undefined';
    }

    return { accountid: accountid, amount: amount };
}

function getEtransferEmailDocument(emlPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const emlContent = createReadStream(emlPath, 'utf8');
        const emlParser = new EmlParser(emlContent)
        emlParser.getEmailBodyHtml().then((htmlBody) => {
            const dom = new JSDOM(htmlBody);
            const document = dom.window.document;
            resolve(document);
        }).catch((err) => {
            reject(err);
        });
    });
}

describe('JS DOM tests', () => {
    it('should create a JSDOM document from an HTML string', () => {
        const html = '<html><body><p>Hello, world!</p></body></html>';
        const dom = new JSDOM(html);
        const document = dom.window.document;
        expect(document.querySelector('p')?.textContent).toBe('Hello, world!');
    });

    it('should create a JSDOM document from an EML file', async () => {
        const emlPath = join(__dirname, 'etransfer.email.v1.eml');
        const emlContent = createReadStream(emlPath, 'utf8');
        const emlParser = new EmlParser(emlContent);
        const htmlBody = await emlParser.getEmailBodyHtml();
        const dom = new JSDOM(htmlBody);
        const document = dom.window.document;
        // Check that body contains something and print it
        expect(document.querySelector('body')).not.toBeNull
    });
});

describe('parseEtransferEmailFromDOM', () => {
    let log: jest.MockedFunction<Task["log"]>;

    beforeEach(() => {
        log = jest.fn();
    });

    it('should correctly parse the accountid and amount from the e-transfer v1 email', async () => {
        const document = await getEtransferEmailDocument(join(__dirname, 'etransfer.email.v1.eml'));

        // Call the function to test
        const result = parseEtransferEmailFromDOM(document, log);

        // Validate the result
        // Dont want to store account ID's in here 
        // Verify accountid is a 24 character string only containing numbers and letters
        // Verify amount is some correct dollar amount X+.XX
        expect(result.accountid).toMatch(/^[a-zA-Z0-9]{24}$/);
        expect(result.amount).toMatch(/^\d+(\.\d{1,2})?$/);
    });
    it('should correctly parse the accountid and amount from the e-transfer v2 email', async () => {
        const document = await getEtransferEmailDocument(join(__dirname, 'etransfer.email.v2.eml'));

        // Call the function to test
        const result = parseEtransferEmailFromDOM(document, log);

        // Validate the result
        expect(result.accountid).toMatch(/^[a-zA-Z0-9]{24}$/);
        expect(result.amount).toMatch(/^\d+(\.\d{1,2})?$/);
    });
});