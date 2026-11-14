import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const Info: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="info">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Icon>
);

export default Info;
