import arrayify from './arrayify';
import getSubComponentStyles from './getSubComponentStyles';

import getInvalidSubComponents from './getInvalidSubComponents';
import getExpectedPropsFromSelector from './getExpectedPropsFromSelector';
import expandStyles from './expandStyles';

const stringifySubComponentList = (props) => props.map((s) => `::${s}`).join('\n');

const styleProp = '[a-z0-9]+';
const propSelector = '(\\[\\s*(\\w+)\\s*(\\s*=\\s*(\\d+|true|false|"([^"]|\\\\")+")\\s*)?\\s*\\])';
const subComponentSelector = '(::[^\\s:=]+)';

const validSelector = new RegExp(`^${propSelector}+$|^${propSelector}*${subComponentSelector}$|^${styleProp}$`, 'i');
const validateSelector = validSelector.test.bind(validSelector);

const unquotedCommas = /(,)(?=(?:[^"]|"[^"]*")*$)/g;
export function isSelectorValid (selector) {
  return selector.split(unquotedCommas).filter((s) => s !== ',').map((s) => s.trim()).every(validateSelector);
}

export const validSelectorExamples = [
  '::subComponent',
  '::subComponent, ::subComponent2',
  '[prop]',
  '[prop=false]',
  '[prop=42]',
  '[prop="string"], [prop2=42]',
  '[prop]::subComponent',
  '[prop1][prop2="string"]::subComponent',
];

const helpfulExamplesString = `Here are some examples of valid selectors:\n${validSelectorExamples.map((s) => '  ' + s).join('\n')}`;

export default function validateStyles ({
  subComponentTypes,
  propTypes,
}, props, propName, componentName) {
  const errors = [];

  if (!props[propName]) {
    return null;
  }

  const styles = arrayify(props[propName]);

  styles.forEach((styleSet) => {
    if (typeof styleSet !== 'object') {
      return;
    }

    const malformedSelectors = Object.keys(styleSet).filter((s) => !isSelectorValid(s));

    if (malformedSelectors.length > 0) {
      errors.push(`Malformed selector${
        malformedSelectors.length !== 1 ? 's' : ''
      }: ${malformedSelectors.map((s) => `"${s}"`).join(', ')}\n\n${helpfulExamplesString}\n\n`);
    }
  });

  const expandedStyles = styles.map(expandStyles).reduce((flattenedStyles, styleList) => {
    flattenedStyles.push(...styleList);
    return flattenedStyles;
  }, []);

  const subComponentStyles = getSubComponentStyles({
    styles: expandedStyles,
  });

  delete subComponentStyles.root;

  const invalidSubComponents = getInvalidSubComponents({
    subComponents: Object.keys(subComponentStyles),
    subComponentTypes,
  });

  if (invalidSubComponents) {
    const errorIntro = (invalidSubComponents.length > 1
      ? `[${stringifySubComponentList(invalidSubComponents)}] are not valid sub-components of \`${componentName}\`.`
      : `${stringifySubComponentList(invalidSubComponents)} is not a valid sub-component of \`${componentName}\`.`
    );

    errors.push(
      '\n\n' + errorIntro + '\n\nValid sub-components are:\n\n' +
        stringifySubComponentList(Object.keys(subComponentTypes)) +
        '\n\n'
    );
  }

  if (propTypes) {
    styles.filter((s) => !!s && (typeof s === 'object')).forEach((styles) => {
      Object.keys(styles).forEach((propString) => {
        let expectedProps;
        try {
          expectedProps = getExpectedPropsFromSelector(propString);
        } catch (error) {
          errors.push(error.message || error);
        }

        if (expectedProps) {
          Object.keys(expectedProps).forEach((propName) => {
            const propValidator = propTypes[propName];

            if (!propValidator) {
              return;
            }

            const prefix = `"${propString}" is not a valid selector. `;

            try {
              const error = propValidator(expectedProps, propName, componentName, 'prop');
              if (error instanceof Error) {
                errors.push(prefix + error.message);
              }
            } catch (error) {
              errors.push(prefix + (error.message || error));
            }
          });
        }
      });
    });
  }

  if (errors.length > 0) {
    return new Error(errors.join('\n'));
  }

  return null;
}
