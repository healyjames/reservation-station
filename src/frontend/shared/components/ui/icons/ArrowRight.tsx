import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const ArrowRight: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="arrow-right">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
);

export default ArrowRight;
