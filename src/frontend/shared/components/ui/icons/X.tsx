import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const X: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="x">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);

export default X;
