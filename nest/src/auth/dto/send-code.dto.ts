import { IsString } from 'class-validator';
export class SendCodeDto {
  @IsString()
  phone: string;
}
