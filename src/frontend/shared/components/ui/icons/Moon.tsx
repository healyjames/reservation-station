import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const Moon: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="moon">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Icon>
);

export default Moon;
