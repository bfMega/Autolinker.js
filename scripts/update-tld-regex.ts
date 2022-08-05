import axios from 'axios';
import dedent from 'dedent';
import fse from 'fs-extra';
import punycode from 'punycode';

if (require.main === module) {
    // If called directly from the command line
    updateTldRegex().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

export async function updateTldRegex() {
    const tldsFile = await axios.get<string>('http://data.iana.org/TLD/tlds-alpha-by-domain.txt', {
        responseType: 'text',
    });

    let tldRegex = domainsToRegex(tldsFile.data);
    const matches = tldRegex.match(/[\u007F-\uFFFF]/g) || [];
    matches.forEach(match => {
        const codePoint = (match.codePointAt(0) | 0).toString(16).padStart(4, '0');
        tldRegex = tldRegex.replace(new RegExp(match, 'g'), `\\u${codePoint}`);
    });
    let outputFile = dedent`
        // NOTE: THIS IS A GENERATED FILE\n// To update with the latest TLD list, run \`npm run update-tld-regex\`\n\n
        ${tldRegex}
    `;
    fse.writeFile('./src/matcher/tld-regex.ts', outputFile);
}

function domainsToRegex(contents: string): string {
    let lines = contents.split('\n').filter(notCommentLine);

    let domains = lines
        .map(dePunycodeDomain)
        .flat()
        .filter(s => !!s) // remove empty elements;
        .sort(compareLengthLongestFirst);

    const domainsRegexStr = `export const tldRegex = /(?:${domains.join('|')})/;\n`;
    return domainsRegexStr;
}

function notCommentLine(line: string): boolean {
    return !/^#/.test(line);
}

function dePunycodeDomain(domain: string): string[] {
    domain = domain.toLowerCase();
    if (/xn--/.test(domain)) {
        return [domain, punycode.toUnicode(domain)];
    }
    return [domain];
}

function compareLengthLongestFirst(a: string, b: string): number {
    var result = b.length - a.length;
    if (result === 0) {
        result = a.localeCompare(b);
    }
    return result;
}
