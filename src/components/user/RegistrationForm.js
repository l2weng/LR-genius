'use strict'

const React = require('react')
const { Component } = React
const {
  Form, Input, Tooltip, Icon, Select, Row, Col, Button, notification, message
} = require('antd')
const FormItem = Form.Item
const Option = Select.Option
const axios = require('axios')
const { machineIdSync } = require('node-machine-id')
const { func } = require('prop-types')

class RegistrationForm extends Component {
  state = {
    confirmDirty: false,
  };

  handleSubmit = (e) => {
    e.preventDefault()
    this.props.form.validateFieldsAndScroll((err, values) => {
      values = { userType: 1, status: 1, machineId: machineIdSync({ original: true }), ...values }
      if (!err) {
        axios.post(`${ARGS.apiServer}/users/create`, values).then(res => {
          if (res.status === 200) {
            const key = `open${Date.now()}`
            const btn = (
              <Button type="primary" size="small" onClick={() => notification.close(key)}>
                Go
              </Button>
            )
            notification.open({
              message: '注册成功',
              description: 'LabelReal带您开启AI标注大门',
              icon: <Icon type="smile" style={{ color: '#108ee9' }} />,
              btn,
              key,
              onClose: this.close,
            })
          }
        })
        .catch((err)=> {
          message.error('服务器问题, 请联系客服', err)
        })
      }
    })
  }

  close = () => {
    console.log('Notification was closed. Either the close button was clicked or duration time elapsed.')
  }

  handleConfirmBlur = (e) => {
    const value = e.target.value
    this.setState({ confirmDirty: this.state.confirmDirty || !!value })
  }

  compareToFirstPassword = (rule, value, callback) => {
    const form = this.props.form
    if (value && value !== form.getFieldValue('password')) {
      callback('Two passwords that you enter is inconsistent!')
    } else {
      callback()
    }
  }

  validateToNextPassword = (rule, value, callback) => {
    const form = this.props.form
    if (value && this.state.confirmDirty) {
      form.validateFields(['confirm'], { force: true })
    }
    callback()
  }

  render() {
    const { getFieldDecorator } = this.props.form

    const formItemLayout = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 10 },
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 14 },
      },
    }
    const tailFormItemLayout = {
      wrapperCol: {
        xs: {
          span: 24,
          offset: 0,
        },
        sm: {
          span: 16,
          offset: 8,
        },
      },
    }
    const prefixSelector = getFieldDecorator('prefix', {
      initialValue: '86',
    })(
      <Select style={{ width: 70 }}>
        <Option value="86">+86</Option>
        <Option value="87">+87</Option>
      </Select>
    )

    return (
      <div style={{ width: '500px' }}>
        <Form onSubmit={this.handleSubmit}>
          <FormItem
            {...formItemLayout}
            label="E-mail">
            {getFieldDecorator('email', {
              rules: [{
                type: 'email', message: 'The input is not valid E-mail!',
              }, {
                required: true, message: 'Please input your E-mail!',
              }],
            })(
              <Input />
          )}
          </FormItem><FormItem
            {...formItemLayout}
            label="Company Name">
            {getFieldDecorator('companyName', {
              rules: [{
                required: true, message: 'Please input your Company name!',
              }],
            })(
              <Input />
          )}
          </FormItem>
          <FormItem
            {...formItemLayout}
            label="Password">
            {getFieldDecorator('password', {
              rules: [{
                required: true, message: 'Please input your password!',
              }, {
                validator: this.validateToNextPassword,
              }],
            })(
              <Input type="password" />
          )}
          </FormItem>
          <FormItem
            {...formItemLayout}
            label="Confirm Password">
            {getFieldDecorator('confirm', {
              rules: [{
                required: true, message: 'Please confirm your password!',
              }, {
                validator: this.compareToFirstPassword,
              }],
            })(
              <Input type="password" onBlur={this.handleConfirmBlur} />
          )}
          </FormItem>
          <FormItem
            {...formItemLayout}
            label={(
              <span>
              Nickname&nbsp;
                <Tooltip title="What do you want others to call you?">
                  <Icon type="question-circle-o" />
                </Tooltip>
              </span>
          )}>
            {getFieldDecorator('name', {
              rules: [{ required: true, message: 'Please input your nickname!', whitespace: true }],
            })(
              <Input />
          )}
          </FormItem>
          <FormItem
            {...formItemLayout}
            label="Phone Number">
            {getFieldDecorator('phone', {
              rules: [{ required: true, message: 'Please input your phone number!' }],
            })(
              <Input addonBefore={prefixSelector} style={{ width: '100%' }} />
          )}
          </FormItem>
          <FormItem
            {...formItemLayout}
            label="Captcha"
            extra="We must make sure that your are a human.">
            <Row gutter={8}>
              <Col span={12}>
                {getFieldDecorator('captcha', {
                  rules: [{ required: true, message: 'Please input the captcha you got!' }],
                })(
                  <Input />
              )}
              </Col>
              <Col span={12}>
                <Button>Get captcha</Button>
              </Col>
            </Row>
          </FormItem>
          <FormItem {...tailFormItemLayout}>
            <Button type="primary" htmlType="submit">Register</Button>
            <Button style={{ marginLeft: 8 }} onClick={this.props.needLogin}>
              Back
            </Button>
          </FormItem>
        </Form>
      </div>
    )
  }

  static propTypes = {
    needLogin: func.isRequired
  }
}

module.exports = {
  RegistrationForm
}
