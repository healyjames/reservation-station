import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const ArrowLeft: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="arrow-left">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
);

export default ArrowLeft;
